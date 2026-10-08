const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { newDb } = require('pg-mem');
const db = require('../database/db');
const { migratePaymentSchema, migrateManualUpiReview } = require('../database/paymentMigration');

let testPool;
db.getClient = () => testPool.connect();
db.query = (text, params) => testPool.query(text, params);

const {
  ManualPaymentError,
  createPaymentRequest,
  getPaymentStatus,
  submitUtr,
  reviewPayment,
} = require('../services/manualUpiPaymentService');

const originalUpiId = process.env.UPI_ID;
const originalUpiName = process.env.UPI_DISPLAY_NAME;
const originalFee = process.env.REGISTRATION_FEE;
const originalCurrency = process.env.CURRENCY;
process.env.UPI_ID = 'arena.test@upi';
process.env.UPI_DISPLAY_NAME = 'Free Fire Arena Test';
process.env.REGISTRATION_FEE = '40';
process.env.CURRENCY = 'INR';

async function createTestDatabase() {
  const memoryDatabase = newDb();
  const Pool = memoryDatabase.adapters.createPg().Pool;
  testPool = new Pool();
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  await testPool.query(schema);
  await migratePaymentSchema(testPool);
  await migrateManualUpiReview(testPool);
  await migrateManualUpiReview(testPool);
  const admin = await testPool.query(
    `INSERT INTO admins (email, password_hash) VALUES ('admin@example.com', 'test-hash') RETURNING id`
  );
  const tournament = await testPool.query(
    `INSERT INTO tournaments (name, date, start_time, entry_fee, prize_amount, squad_size, max_slots)
     VALUES ('Manual UPI Test Cup', CURRENT_DATE, '08:00 PM', 40, 300, 4, 100)
     RETURNING id`
  );
  return { pool: testPool, adminId: admin.rows[0].id, tournamentId: tournament.rows[0].id };
}

async function createRegistration(tournamentId, captain, playerCount = 4) {
  const registrationResult = await testPool.query(
    `INSERT INTO registrations
       (tournament_id, captain_name, captain_email, captain_phone, status, email_verified,
        payment_status, reservation_expires_at)
     VALUES ($1, $2, $3, '9876543210', 'OTP_VERIFIED', TRUE, 'PENDING',
             CURRENT_TIMESTAMP + INTERVAL '15 minutes')
     RETURNING id`,
    [tournamentId, captain, `${captain.toLowerCase().replace(/\s/g, '.')}@example.com`]
  );
  const registrationId = registrationResult.rows[0].id;
  for (let player = 1; player <= playerCount; player += 1) {
    await testPool.query(
      `INSERT INTO players (registration_id, player_number, full_name, free_fire_id)
       VALUES ($1, $2, $3, $4)`,
      [registrationId, player, `${captain} ${player}`, `${captain.replace(/\s/g, '')}_FF_${player}`]
    );
  }
  return registrationId;
}

test('configuration creates a local UPI QR URI for exactly ₹40 without a gateway', async () => {
  await createTestDatabase();
  const registrationId = await createRegistration(1, 'Captain One');
  const result = await createPaymentRequest(registrationId);
  assert.equal(result.amount, 40);
  assert.equal(result.currency, 'INR');
  assert.equal(result.paymentMethod, 'UPI_QR');
  assert.equal(result.status, 'PENDING');
  assert.equal(result.upiId, 'arena.test@upi');
  const uri = new URL(result.upiUri);
  assert.equal(uri.protocol, 'upi:');
  assert.equal(uri.hostname, 'pay');
  assert.equal(uri.searchParams.get('pa'), 'arena.test@upi');
  assert.equal(uri.searchParams.get('am'), '40.00');
  assert.equal(uri.searchParams.get('cu'), 'INR');

  const payment = await testPool.query(`SELECT amount, status, provider, payment_method FROM payments`);
  assert.deepEqual(payment.rows[0], {
    amount: 40,
    status: 'PENDING',
    provider: 'manual_upi',
    payment_method: 'UPI_QR',
  });
  const registration = await testPool.query(`SELECT status, payment_status FROM registrations WHERE id = $1`, [registrationId]);
  assert.equal(registration.rows[0].status, 'PAYMENT_PENDING');
  assert.equal(registration.rows[0].payment_status, 'PENDING');
  await testPool.end();
});

test('payment setup fails closed when UPI ID or fixed fee configuration is invalid', async () => {
  await createTestDatabase();
  const registrationId = await createRegistration(1, 'Captain Missing UPI');
  const configuredUpiId = process.env.UPI_ID;
  process.env.UPI_ID = '';
  await assert.rejects(createPaymentRequest(registrationId), (error) => (
    error instanceof ManualPaymentError && error.code === 'UPI_NOT_CONFIGURED'
  ));
  process.env.UPI_ID = configuredUpiId;
  process.env.REGISTRATION_FEE = '10';
  await assert.rejects(createPaymentRequest(registrationId), (error) => (
    error instanceof ManualPaymentError && error.code === 'UPI_NOT_CONFIGURED'
  ));
  process.env.REGISTRATION_FEE = '40';
  await testPool.end();
});

test('UTR submission validates input, hides UTR from public status, and never confirms the team', async () => {
  await createTestDatabase();
  const registrationId = await createRegistration(1, 'Captain Two');
  await createPaymentRequest(registrationId);
  for (const invalidUtr of ['', '1234', '!!!invalid!!!']) {
    await assert.rejects(submitUtr(registrationId, invalidUtr), (error) => (
      error instanceof ManualPaymentError && error.code === 'INVALID_UTR'
    ));
  }

  const submitted = await submitUtr(registrationId, '  123456789012  ');
  assert.equal(submitted.status, 'UTR_SUBMITTED');
  const status = await getPaymentStatus(registrationId);
  assert.equal(status.status, 'UTR_SUBMITTED');
  assert.equal(Object.hasOwn(status, 'utr'), false);

  const payment = await testPool.query(`SELECT status, utr FROM payments WHERE registration_id = $1`, [registrationId]);
  assert.equal(payment.rows[0].status, 'UTR_SUBMITTED');
  assert.equal(payment.rows[0].utr, '123456789012');
  const registration = await testPool.query(`SELECT status, payment_status FROM registrations WHERE id = $1`, [registrationId]);
  assert.equal(registration.rows[0].status, 'PAYMENT_PENDING');
  assert.equal(registration.rows[0].payment_status, 'UTR_SUBMITTED');
  await testPool.end();
});

test('unique UTR index prevents simultaneous use for two registrations', async () => {
  await createTestDatabase();
  const firstId = await createRegistration(1, 'Captain Three');
  const secondId = await createRegistration(1, 'Captain Four');
  await createPaymentRequest(firstId);
  await createPaymentRequest(secondId);
  const results = await Promise.allSettled([
    submitUtr(firstId, '998877665544'),
    submitUtr(secondId, '998877665544'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  const uses = await testPool.query(
    `SELECT COUNT(*) AS count FROM payments WHERE LOWER(utr) = LOWER('998877665544')`
  );
  assert.equal(Number(uses.rows[0].count), 1);
  await testPool.end();
});

test('only admin review verifies or rejects, and review plus registration update is atomic', async () => {
  await createTestDatabase();
  const verifiedRegistrationId = await createRegistration(1, 'Captain Five');
  const rejectedRegistrationId = await createRegistration(1, 'Captain Six');
  await createPaymentRequest(verifiedRegistrationId);
  await createPaymentRequest(rejectedRegistrationId);
  await submitUtr(verifiedRegistrationId, '554433221100');
  await submitUtr(rejectedRegistrationId, '112233445566');

  const verifiedPayment = await testPool.query(`SELECT id FROM payments WHERE registration_id = $1`, [verifiedRegistrationId]);
  const verified = await reviewPayment(verifiedPayment.rows[0].id, 1, 'verify');
  assert.equal(verified.status, 'VERIFIED');
  const confirmedRegistration = await testPool.query(
    `SELECT status, payment_status FROM registrations WHERE id = $1`,
    [verifiedRegistrationId]
  );
  assert.equal(confirmedRegistration.rows[0].status, 'CONFIRMED');
  assert.equal(confirmedRegistration.rows[0].payment_status, 'VERIFIED');
  await assert.rejects(reviewPayment(verifiedPayment.rows[0].id, 1, 'verify'), (error) => (
    error instanceof ManualPaymentError && error.code === 'PAYMENT_NOT_REVIEWABLE'
  ));

  const rejectedPayment = await testPool.query(`SELECT id FROM payments WHERE registration_id = $1`, [rejectedRegistrationId]);
  await assert.rejects(reviewPayment(rejectedPayment.rows[0].id, 1, 'reject', 'x'), (error) => (
    error instanceof ManualPaymentError && error.code === 'INVALID_REJECTION_REASON'
  ));
  const unchanged = await testPool.query(
    `SELECT p.status AS payment_status, r.status AS registration_status
     FROM payments p JOIN registrations r ON r.id = p.registration_id WHERE p.id = $1`,
    [rejectedPayment.rows[0].id]
  );
  assert.equal(unchanged.rows[0].payment_status, 'UTR_SUBMITTED');
  assert.equal(unchanged.rows[0].registration_status, 'PAYMENT_PENDING');

  const rejected = await reviewPayment(rejectedPayment.rows[0].id, 1, 'reject', 'UTR does not match payment');
  assert.equal(rejected.status, 'REJECTED');
  const rejectedRow = await testPool.query(
    `SELECT id, registration_id, status FROM payments WHERE id = $1`,
    [rejectedPayment.rows[0].id]
  );
  assert.equal(rejectedRow.rows[0].registration_id, rejectedRegistrationId);
  assert.equal(rejectedRow.rows[0].status, 'REJECTED');
  // pg-mem does not refresh a partial index when a row leaves its indexed status; the index behavior is tested separately.
  await testPool.query(`
    DROP INDEX idx_payments_one_active_attempt_per_registration;
    DROP INDEX idx_payments_one_success_per_registration;
  `);
  const corrected = await submitUtr(rejectedRegistrationId, '667788990011');
  assert.equal(corrected.status, 'UTR_SUBMITTED');
  const events = await testPool.query(
    `SELECT event_type, payload FROM payment_events WHERE payment_id = $1 ORDER BY id`,
    [rejectedPayment.rows[0].id]
  );
  assert.deepEqual(events.rows.map((event) => event.event_type), [
    'PAYMENT_REQUEST_CREATED',
    'UTR_SUBMITTED',
    'PAYMENT_REJECTED',
    'UTR_SUBMITTED',
  ]);
  assert.equal(events.rows[2].payload.adminId, 1);
  assert.equal(events.rows[2].payload.rejectionReason, 'UTR does not match payment');
  await testPool.end();
});

test('registration must contain exactly four players and the stored tournament fee must be ₹40', async () => {
  await createTestDatabase();
  const shortSquad = await createRegistration(1, 'Captain Seven', 3);
  await assert.rejects(createPaymentRequest(shortSquad), (error) => (
    error instanceof ManualPaymentError && error.code === 'INVALID_REGISTRATION'
  ));
  const tournament = await testPool.query(
    `INSERT INTO tournaments (name, date, start_time, entry_fee, prize_amount)
     VALUES ('Wrong fee', CURRENT_DATE, '08:00 PM', 10, 300) RETURNING id`
  );
  const wrongFeeRegistration = await createRegistration(tournament.rows[0].id, 'Captain Eight');
  await assert.rejects(createPaymentRequest(wrongFeeRegistration), (error) => (
    error instanceof ManualPaymentError && error.code === 'INVALID_REGISTRATION'
  ));
  await assert.rejects(testPool.query(
    `INSERT INTO payments
       (registration_id, tournament_id, order_id, amount, currency, status, payment_method, provider)
     VALUES ($1, $2, 'bad-amount', 10, 'INR', 'PENDING', 'UPI_QR', 'manual_upi')`,
    [wrongFeeRegistration, tournament.rows[0].id]
  ));
  await testPool.end();
});

test('legacy payment records and event data survive while new UTR schema migrates', async () => {
  const memoryDatabase = newDb();
  const Pool = memoryDatabase.adapters.createPg().Pool;
  testPool = new Pool();
  await testPool.query(`
    CREATE TABLE admins (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL);
    CREATE TABLE tournaments (id SERIAL PRIMARY KEY);
    CREATE TABLE registrations (
      id SERIAL PRIMARY KEY, tournament_id INT NOT NULL REFERENCES tournaments(id),
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING', payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE players (
      id SERIAL PRIMARY KEY, registration_id INT NOT NULL REFERENCES registrations(id),
      player_number INT NOT NULL, full_name VARCHAR(255) NOT NULL, free_fire_id VARCHAR(100) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE payments (
      id SERIAL PRIMARY KEY, registration_id INT NOT NULL REFERENCES registrations(id),
      razorpay_order_id VARCHAR(255) UNIQUE, razorpay_payment_id VARCHAR(255) UNIQUE,
      razorpay_signature VARCHAR(255), amount NUMERIC(10, 2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR', status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_pay_status CHECK (status IN ('CREATED', 'SUCCESS', 'FAILED', 'VERIFIED'))
    );
    CREATE TABLE payment_events (
      id SERIAL PRIMARY KEY, payment_id INT REFERENCES payments(id) ON DELETE SET NULL,
      provider VARCHAR(50) NOT NULL, event_id VARCHAR(255), event_type VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb, signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
      processed BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO admins (email, password_hash) VALUES ('admin@example.com', 'test-hash');
    INSERT INTO tournaments (id) VALUES (1);
    INSERT INTO registrations (id, tournament_id) VALUES (1, 1);
    INSERT INTO payments
      (registration_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, status)
    VALUES (1, 'old-order', 'old-payment', 'old-signature', 40, 'VERIFIED');
  `);

  await migratePaymentSchema(testPool);
  await migrateManualUpiReview(testPool);
  const legacy = await testPool.query(
    `SELECT order_id, provider_order_id, provider_transaction_id, status, provider FROM payments WHERE id = 1`
  );
  assert.equal(legacy.rows[0].order_id, 'legacy-order:1');
  assert.equal(legacy.rows[0].provider_order_id, 'old-order');
  assert.equal(legacy.rows[0].provider_transaction_id, 'old-payment');
  assert.equal(legacy.rows[0].status, 'SUCCESS');
  assert.equal(legacy.rows[0].provider, 'legacy_gateway');
  const audit = await testPool.query(`SELECT payload FROM payment_events WHERE payment_id = 1`);
  assert.equal(audit.rows[0].payload.archivedSignature, 'old-signature');
  const utrColumn = await testPool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'utr'`
  );
  assert.equal(utrColumn.rows.length, 1);
  await testPool.end();
});

test.after(() => {
  if (originalUpiId === undefined) delete process.env.UPI_ID;
  else process.env.UPI_ID = originalUpiId;
  if (originalUpiName === undefined) delete process.env.UPI_DISPLAY_NAME;
  else process.env.UPI_DISPLAY_NAME = originalUpiName;
  if (originalFee === undefined) delete process.env.REGISTRATION_FEE;
  else process.env.REGISTRATION_FEE = originalFee;
  if (originalCurrency === undefined) delete process.env.CURRENCY;
  else process.env.CURRENCY = originalCurrency;
});
