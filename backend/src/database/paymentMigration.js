async function getColumns(pool, tableName) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = $1`,
    [tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function assertNoDuplicates(pool, sql, keyOf, label) {
  const result = await pool.query(sql);
  const seen = new Set();
  for (const row of result.rows) {
    const key = keyOf(row);
    if (seen.has(key)) {
      throw new Error(`Payment migration stopped: existing duplicate ${label} values must be reviewed before applying constraints.`);
    }
    seen.add(key);
  }
}

async function migratePaymentSchemaOperations(pool) {
  let paymentColumns = await getColumns(pool, 'payments');
  if (!paymentColumns.size) return;

  await pool.query(`
    ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS tournament_id INT REFERENCES tournaments(id) ON DELETE RESTRICT,
      ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'legacy_gateway',
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
      ADD COLUMN IF NOT EXISTS payment_url TEXT,
      ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
      ADD COLUMN IF NOT EXISTS qr_code_data TEXT,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS status_checked_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS order_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(255)
  `);

  paymentColumns = await getColumns(pool, 'payments');
  if (paymentColumns.has('razorpay_order_id')) {
    await pool.query(`
      UPDATE payments
      SET provider_order_id = COALESCE(provider_order_id, razorpay_order_id),
          order_id = COALESCE(order_id, 'legacy-order:' || id::text)
    `);
    await pool.query('ALTER TABLE payments DROP COLUMN razorpay_order_id');
  }
  if (paymentColumns.has('razorpay_payment_id')) {
    await pool.query(
      `UPDATE payments
       SET provider_transaction_id = COALESCE(provider_transaction_id, razorpay_payment_id)`
    );
    await pool.query('ALTER TABLE payments DROP COLUMN razorpay_payment_id');
  }

  const missingTournamentPayments = await pool.query(
    `SELECT payments.id, registrations.tournament_id
     FROM payments
     JOIN registrations ON registrations.id = payments.registration_id
     WHERE payments.tournament_id IS NULL`
  );
  for (const payment of missingTournamentPayments.rows) {
    await pool.query(
      `UPDATE payments SET tournament_id = $1 WHERE id = $2`,
      [payment.tournament_id, payment.id]
    );
  }
  await pool.query(`
    UPDATE payments
    SET order_id = 'legacy-order:' || id::text
    WHERE order_id IS NULL OR order_id = ''
  `);

  await pool.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_pay_status');
  await pool.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_status');
  await pool.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_amount_positive');
  await pool.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_currency_inr');
  await pool.query('ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_registration_status');
  await pool.query('ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_payment_status');

  paymentColumns = await getColumns(pool, 'payments');
  if (paymentColumns.has('razorpay_signature')) {
    const signatures = await pool.query(
      `SELECT id, provider, razorpay_signature
       FROM payments WHERE razorpay_signature IS NOT NULL`
    );
    for (const payment of signatures.rows) {
      const eventId = `legacy-verification:${payment.id}`;
      const existingEvent = await pool.query(
        `SELECT id FROM payment_events WHERE provider = $1 AND event_id = $2`,
        [payment.provider, eventId]
      );
      if (!existingEvent.rows.length) {
        await pool.query(
          `INSERT INTO payment_events
             (payment_id, provider, event_id, event_type, payload, signature_verified, processed)
           VALUES ($1, $2, $3, 'LEGACY_PAYMENT_VERIFICATION', $4::jsonb, FALSE, TRUE)`,
          [
            payment.id,
            payment.provider,
            eventId,
            JSON.stringify({ archivedSignature: payment.razorpay_signature }),
          ]
        );
      }
    }
    await pool.query('ALTER TABLE payments DROP COLUMN razorpay_signature');
  }

  await pool.query(`
    ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS status_checked_at TIMESTAMP WITH TIME ZONE
  `);
  await pool.query(`
    ALTER TABLE payment_events
      ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS failure_reason TEXT
  `);
  await pool.query(`
    ALTER TABLE registrations
      ADD COLUMN IF NOT EXISTS public_access_token_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMP WITH TIME ZONE
  `);

  await pool.query(`
    UPDATE payments
    SET status = CASE
      WHEN status IN ('VERIFIED', 'SUCCESS') THEN 'SUCCESS'
      WHEN status = 'CREATED' THEN 'CANCELLED'
      WHEN status IN ('PENDING', 'PROCESSING', 'FAILED', 'REFUNDED', 'CANCELLED') THEN status
      ELSE NULL
    END
  `);
  const invalidStatuses = await pool.query(
    `SELECT id FROM payments WHERE status IS NULL LIMIT 1`
  );
  if (invalidStatuses.rows.length) {
    throw new Error('Payment migration stopped: an existing payment has an unknown status; review it before migration.');
  }
  await pool.query(`
    UPDATE payments
    SET paid_at = COALESCE(paid_at, updated_at)
    WHERE status = 'SUCCESS'
  `);
  await pool.query(`
    UPDATE payments SET order_id = 'legacy-order:' || id::text
    WHERE order_id IS NULL OR order_id = ''
  `);
  await pool.query(`
    UPDATE registrations
    SET reservation_expires_at = created_at + INTERVAL '15 minutes'
    WHERE reservation_expires_at IS NULL
      AND status IN ('PENDING', 'OTP_VERIFIED', 'PAYMENT_PENDING', 'PAYMENT_PROCESSING', 'PAYMENT_FAILED')
  `);

  const invalidAmounts = await pool.query(
    `SELECT id FROM payments WHERE amount IS NULL OR amount <= 0 LIMIT 1`
  );
  if (invalidAmounts.rows.length) {
    throw new Error('Payment migration stopped: existing payments contain a non-positive amount; review records before migration.');
  }
  const invalidCurrencies = await pool.query(
    `SELECT id FROM payments WHERE currency IS NULL OR currency <> 'INR' LIMIT 1`
  );
  if (invalidCurrencies.rows.length) {
    throw new Error('Payment migration stopped: existing payments contain a non-INR currency; review records before migration.');
  }

  await assertNoDuplicates(
    pool,
    `SELECT registration_id, free_fire_id FROM players`,
    (row) => `${row.registration_id}:${String(row.free_fire_id).toLowerCase()}`,
    'player Free Fire ID'
  );
  await assertNoDuplicates(
    pool,
    `SELECT provider, provider_transaction_id FROM payments WHERE provider_transaction_id IS NOT NULL`,
    (row) => `${row.provider}:${row.provider_transaction_id}`,
    'provider transaction ID'
  );
  await assertNoDuplicates(
    pool,
    `SELECT provider, provider_order_id FROM payments WHERE provider_order_id IS NOT NULL`,
    (row) => `${row.provider}:${row.provider_order_id}`,
    'provider order ID'
  );
  await assertNoDuplicates(
    pool,
    `SELECT provider, event_id FROM payment_events WHERE event_id IS NOT NULL`,
    (row) => `${row.provider}:${row.event_id}`,
    'provider event ID'
  );
  await assertNoDuplicates(
    pool,
    `SELECT registration_id FROM payments WHERE status IN ('SUCCESS', 'REFUNDED')`,
    (row) => String(row.registration_id),
    'successful payment per registration'
  );
  await assertNoDuplicates(
    pool,
    `SELECT registration_id FROM payments WHERE status IN ('PENDING', 'PROCESSING')`,
    (row) => String(row.registration_id),
    'active payment per registration'
  );

  await pool.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_razorpay_order_id_key');
  await pool.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_razorpay_payment_id_key');
  await pool.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_order_id_key');
  await pool.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_transaction_id_key');
  await pool.query('ALTER TABLE payments ALTER COLUMN order_id SET NOT NULL');
  await pool.query('ALTER TABLE payments ALTER COLUMN tournament_id SET NOT NULL');
  await pool.query('ALTER TABLE payments ALTER COLUMN provider SET NOT NULL');
  await pool.query('ALTER TABLE payments ALTER COLUMN amount SET NOT NULL');
  await pool.query('ALTER TABLE payments ALTER COLUMN currency SET NOT NULL');
  await pool.query(`ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'PENDING'`);
  await pool.query(`
    ALTER TABLE payments
      ADD CONSTRAINT chk_payments_status
        CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED')),
      ADD CONSTRAINT chk_payments_amount_positive CHECK (amount > 0),
      ADD CONSTRAINT chk_payments_currency_inr CHECK (currency = 'INR')
  `);

  await pool.query(`
    UPDATE registrations
    SET payment_status = CASE
      WHEN payment_status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED') THEN payment_status
      ELSE NULL
    END
  `);
  const invalidRegistrationPaymentStatuses = await pool.query(
    `SELECT id FROM registrations WHERE payment_status IS NULL LIMIT 1`
  );
  if (invalidRegistrationPaymentStatuses.rows.length) {
    throw new Error('Payment migration stopped: an existing registration has an unknown payment status; review it before migration.');
  }
  await pool.query(`
    UPDATE registrations
    SET status = CASE
      WHEN status IN ('PENDING', 'OTP_VERIFIED', 'PAYMENT_PENDING', 'PAYMENT_PROCESSING', 'PAYMENT_FAILED', 'CONFIRMED', 'CANCELLED', 'FAILED') THEN status
      ELSE NULL
    END
  `);
  const invalidRegistrationStatuses = await pool.query(
    `SELECT id FROM registrations WHERE status IS NULL LIMIT 1`
  );
  if (invalidRegistrationStatuses.rows.length) {
    throw new Error('Payment migration stopped: an existing registration has an unknown status; review it before migration.');
  }
  await pool.query(`
    ALTER TABLE registrations
      ADD CONSTRAINT chk_registration_status
        CHECK (status IN ('PENDING', 'OTP_VERIFIED', 'PAYMENT_PENDING', 'PAYMENT_PROCESSING', 'PAYMENT_FAILED', 'CONFIRMED', 'CANCELLED', 'FAILED')),
      ADD CONSTRAINT chk_payment_status
        CHECK (payment_status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED'))
  `);
  await pool.query(`
    ALTER TABLE payment_events
      ALTER COLUMN received_at SET NOT NULL
  `);
  await pool.query(`
    UPDATE payment_events
    SET processed_at = COALESCE(processed_at, received_at)
    WHERE processed = TRUE AND processed_at IS NULL
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_order_id
      ON payments(provider, provider_order_id) WHERE provider_order_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_transaction_id
      ON payments(provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_active_attempt_per_registration
      ON payments(registration_id) WHERE status IN ('PENDING', 'PROCESSING');
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_success_per_registration
      ON payments(registration_id) WHERE status IN ('SUCCESS', 'REFUNDED');
    CREATE INDEX IF NOT EXISTS idx_payments_registration_status
      ON payments(registration_id, status, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_provider_event
      ON payment_events(provider, event_id) WHERE event_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_payment_events_payment_received
      ON payment_events(payment_id, received_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_public_access_token
      ON registrations(public_access_token_hash) WHERE public_access_token_hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_registrations_capacity_reservation
      ON registrations(tournament_id, reservation_expires_at, status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_players_unique_registration_free_fire_id
      ON players(registration_id, LOWER(free_fire_id));
  `);

  await pool.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_razorpay_order_id_key');
  await pool.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_razorpay_payment_id_key');
}

async function migratePaymentSchema(pool, options = {}) {
  if (options.transaction === false) {
    return migratePaymentSchemaOperations(pool);
  }

  const client = typeof pool.connect === 'function' ? await pool.connect() : pool;
  try {
    await client.query('BEGIN');
    await migratePaymentSchemaOperations(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (client !== pool) client.release();
  }
}

async function migrateManualUpiReview(pool) {
  const paymentColumns = await getColumns(pool, 'payments');
  if (!paymentColumns.size) return;

  await pool.query(`
    ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS utr VARCHAR(64),
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS verified_by INT REFERENCES admins(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT
  `);

  await assertNoDuplicates(
    pool,
    `SELECT LOWER(utr) AS utr FROM payments WHERE utr IS NOT NULL AND utr <> ''`,
    (row) => row.utr,
    'UPI UTR'
  );

  await pool.query(`
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_status;
    ALTER TABLE payments
      ADD CONSTRAINT chk_payments_status
        CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED', 'UTR_SUBMITTED', 'VERIFIED', 'REJECTED'));
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_manual_upi_amount;
    ALTER TABLE payments
      ADD CONSTRAINT chk_manual_upi_amount
        CHECK (provider <> 'manual_upi' OR (amount = 40.00 AND currency = 'INR' AND payment_method = 'UPI_QR'));
    ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_payment_status;
    ALTER TABLE registrations
      ADD CONSTRAINT chk_payment_status
        CHECK (payment_status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'UTR_SUBMITTED', 'VERIFIED', 'REJECTED'));
  `);

  await pool.query(`
    DROP INDEX IF EXISTS idx_payments_one_active_attempt_per_registration;
    DROP INDEX IF EXISTS idx_payments_one_success_per_registration;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_utr_unique
      ON payments(LOWER(utr)) WHERE utr IS NOT NULL;
    CREATE UNIQUE INDEX idx_payments_one_active_attempt_per_registration
      ON payments(registration_id) WHERE status IN ('PENDING', 'PROCESSING', 'UTR_SUBMITTED');
    CREATE UNIQUE INDEX idx_payments_one_success_per_registration
      ON payments(registration_id) WHERE status IN ('SUCCESS', 'REFUNDED', 'VERIFIED');
    CREATE INDEX IF NOT EXISTS idx_payments_manual_review
      ON payments(status, submitted_at DESC) WHERE provider = 'manual_upi';
  `);
}

module.exports = { migratePaymentSchema, migrateManualUpiReview };
