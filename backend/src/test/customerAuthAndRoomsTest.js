const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { newDb } = require('pg-mem');
const database = require('../database/db');
const { migratePaymentSchema, migrateManualUpiReview } = require('../database/paymentMigration');
const { migrateCustomerAuthAndSquads } = require('../database/customerAuthAndSquadsMigration');
const { migrateEmailOtpRateLimits } = require('../database/emailOtpRateLimitsMigration');

let pool;
let sentLoginOtp;
let roomEmailAttempts;
database.getClient = () => pool.connect();
database.query = (sql, params) => pool.query(sql, params);
const emailService = require('../services/emailService');
emailService.sendLoginOtpEmail = async (_email, otp) => {
  sentLoginOtp = otp;
  return { messageId: 'test-login-email', accepted: [_email] };
};
emailService.sendRoomCredentialsEmail = async (...args) => {
  roomEmailAttempts += 1;
  if (roomEmailAttempts === 1) throw new Error('SMTP temporarily unavailable');
  return { messageId: 'test-room-email', response: '250 accepted' };
};
const authController = require('../controllers/userAuthController');
const roomEmailService = require('../services/roomEmailService');

async function setupDatabase() {
  const memoryDatabase = newDb();
  const Pool = memoryDatabase.adapters.createPg().Pool;
  pool = new Pool();
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  await pool.query(schema);
  await migratePaymentSchema(pool);
  await migrateManualUpiReview(pool);
  await migrateCustomerAuthAndSquads(pool);
}

test('OTP rate-limit migration safely adds the missing table', async () => {
  const memoryDatabase = newDb();
  const Pool = memoryDatabase.adapters.createPg().Pool;
  const migrationPool = new Pool();
  await migrateEmailOtpRateLimits(migrationPool);
  const table = await migrationPool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = 'email_otp_rate_limits'`
  );
  assert.equal(table.rows.length, 1);
  await migrationPool.end();
});

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    cookieValue: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    cookie(_name, value, options) { this.cookieValue = { value, options }; return this; },
    clearCookie() {},
  };
}

test('passwordless email OTP is hashed, expires, is single-use, and only returns the owner dashboard', async () => {
  await setupDatabase();
  sentLoginOtp = null;
  const requestResponse = responseMock();
  await authController.requestLoginOtp({ body: { email: ' Captain@Example.com ' } }, requestResponse);
  assert.equal(requestResponse.statusCode, 200);
  assert.equal(typeof sentLoginOtp, 'string');
  const otpRow = await pool.query(`SELECT otp_hash, consumed_at FROM email_login_otps WHERE email = $1`, ['captain@example.com']);
  assert.notEqual(otpRow.rows[0].otp_hash, sentLoginOtp);
  assert.equal(await bcrypt.compare(sentLoginOtp, otpRow.rows[0].otp_hash), true);

  const invalidResponse = responseMock();
  await authController.verifyLoginOtp(
    { body: { email: 'captain@example.com', otp: '000000' } },
    invalidResponse
  );
  assert.equal(invalidResponse.statusCode, 400);

  const loginResponse = responseMock();
  await authController.verifyLoginOtp(
    { body: { email: 'captain@example.com', otp: sentLoginOtp } },
    loginResponse
  );
  assert.equal(loginResponse.statusCode, 200);
  assert.equal(loginResponse.cookieValue.options.httpOnly, true);
  assert.equal(loginResponse.cookieValue.options.maxAge, 7 * 24 * 60 * 60 * 1000);
  const sessionHash = require('node:crypto').createHash('sha256').update(loginResponse.cookieValue.value).digest('hex');
  const session = await pool.query(`SELECT email FROM user_sessions WHERE token_hash = $1`, [sessionHash]);
  assert.equal(session.rows[0].email, 'captain@example.com');
  const userAuthMiddleware = require('../middleware/userAuthMiddleware');
  let authenticatedUser = null;
  await userAuthMiddleware.requireUserAuth(
    { headers: { cookie: `ffa_user_session=${loginResponse.cookieValue.value}` } },
    responseMock(),
    () => { authenticatedUser = true; }
  );
  assert.equal(authenticatedUser, true);

  const replayResponse = responseMock();
  await authController.verifyLoginOtp(
    { body: { email: 'captain@example.com', otp: sentLoginOtp } },
    replayResponse
  );
  assert.equal(replayResponse.statusCode, 400);

  const expiredOtpResponse = responseMock();
  await authController.requestLoginOtp(
    { body: { email: 'expired@example.com' } },
    expiredOtpResponse
  );
  await pool.query(
    `UPDATE email_login_otps SET expires_at = $1 WHERE email = $2`,
    [new Date(Date.now() - 60_000), 'expired@example.com']
  );
  const expiredVerification = responseMock();
  await authController.verifyLoginOtp(
    { body: { email: 'expired@example.com', otp: sentLoginOtp } },
    expiredVerification
  );
  assert.equal(expiredVerification.statusCode, 400);

  const tournament = await pool.query(
    `INSERT INTO tournaments (name, date, start_time) VALUES ('Private Cup', CURRENT_DATE, '08:00 PM') RETURNING id`
  );
  const ownRegistration = await pool.query(
    `INSERT INTO registrations (tournament_id, captain_name, captain_email, captain_phone, status, email_verified, payment_status, squad_number)
     VALUES ($1, 'Captain', 'captain@example.com', '1234567890', 'CONFIRMED', TRUE, 'VERIFIED', 1)
     RETURNING id`,
    [tournament.rows[0].id]
  );
  await pool.query(
    `INSERT INTO registrations (tournament_id, captain_name, captain_email, captain_phone, status, email_verified, payment_status, squad_number)
     VALUES ($1, 'Other Captain', 'other@example.com', '1234567891', 'CONFIRMED', TRUE, 'VERIFIED', 2)`,
    [tournament.rows[0].id]
  );
  await pool.query(
    `INSERT INTO players (registration_id, player_number, full_name, free_fire_id)
     VALUES ($1, 1, 'Captain', 'UID-CAPTAIN')`,
    [ownRegistration.rows[0].id]
  );
  const dashboardResponse = responseMock();
  await authController.getUserDashboard({ user: { email: 'captain@example.com' } }, dashboardResponse);
  assert.equal(dashboardResponse.statusCode, 200);
  assert.equal(dashboardResponse.body.registrations.length, 1);
  assert.equal(dashboardResponse.body.registrations[0].captain_name, undefined);
  assert.equal(dashboardResponse.body.registrations[0].players[0].full_name, 'Captain');
  assert.equal(dashboardResponse.body.registrations[0].squad_number, 1);
  assert.equal(Object.hasOwn(dashboardResponse.body.registrations[0], 'room_password'), false);

  const adminMiddleware = require('../middleware/authMiddleware');
  const unauthorizedResponse = responseMock();
  adminMiddleware.requireAdminAuth({ headers: {} }, unauthorizedResponse, () => {});
  assert.equal(unauthorizedResponse.statusCode, 401);
  const adminToken = jwt.sign({ id: 1, role: 'admin' }, adminMiddleware.getSessionSecret());
  let adminAuthorized = false;
  adminMiddleware.requireAdminAuth(
    { headers: { authorization: `Bearer ${adminToken}` } },
    responseMock(),
    () => { adminAuthorized = true; }
  );
  assert.equal(adminAuthorized, true);
  await pool.end();
});

test('room delivery sends only confirmed squads, records provider failures, and permits retry without duplicate success', async () => {
  await setupDatabase();
  roomEmailAttempts = 0;
  const tournamentResult = await pool.query(
    `INSERT INTO tournaments (name, date, start_time, max_slots) VALUES ('Room Test', CURRENT_DATE, '08:00 PM', 13) RETURNING id, name, date, start_time`
  );
  const tournament = tournamentResult.rows[0];
  await pool.query(`INSERT INTO admins (email, password_hash) VALUES ('admin@example.com', 'test-hash')`);
  const registrationResult = await pool.query(
    `INSERT INTO registrations (tournament_id, captain_name, captain_email, captain_phone, status, email_verified, payment_status, squad_number)
     VALUES ($1, 'Verified Captain', 'verified@example.com', '1234567890', 'CONFIRMED', TRUE, 'VERIFIED', 1)
     RETURNING id`,
    [tournament.id]
  );
  const registrationId = registrationResult.rows[0].id;
  const squads = await roomEmailService.getConfirmedSquads(tournament.id);
  assert.equal(squads.length, 1);
  assert.equal(squads[0].email_status, 'EMAIL_PENDING');

  const failed = await roomEmailService.deliverRoomCredentials(
    squads[0], tournament, 'ROOM-01', 'PASS-01', 1
  );
  assert.equal(failed.status, 'EMAIL_FAILED');
  const failedLog = await pool.query(
    `SELECT status, attempts, admin_id, last_error FROM email_logs WHERE registration_id = $1 AND email_type = 'ROOM_CREDENTIALS'`,
    [registrationId]
  );
  assert.equal(failedLog.rows[0].status, 'EMAIL_FAILED');
  assert.equal(failedLog.rows[0].attempts, 1);
  assert.equal(failedLog.rows[0].admin_id, 1);
  assert.match(failedLog.rows[0].last_error, /SMTP temporarily unavailable/);

  const retried = await roomEmailService.deliverRoomCredentials(
    squads[0], tournament, 'ROOM-01', 'PASS-01', 1
  );
  assert.equal(retried.status, 'EMAIL_SENT');
  const duplicate = await roomEmailService.deliverRoomCredentials(
    squads[0], tournament, 'ROOM-01', 'PASS-01', 1
  );
  assert.equal(duplicate.status, 'SKIPPED');
  const deliveredLog = await pool.query(
    `SELECT status, attempts, provider_message_id, provider_response FROM email_logs WHERE registration_id = $1 AND email_type = 'ROOM_CREDENTIALS'`,
    [registrationId]
  );
  assert.equal(deliveredLog.rows[0].status, 'EMAIL_SENT');
  assert.equal(deliveredLog.rows[0].attempts, 2);
  assert.equal(deliveredLog.rows[0].provider_message_id, 'test-room-email');
  assert.equal(deliveredLog.rows[0].provider_response, '250 accepted');
  assert.equal(roomEmailAttempts, 2);
  const history = await pool.query(
    `SELECT attempt_number, status, admin_id, provider_response
     FROM room_email_attempts
     WHERE registration_id = $1
     ORDER BY attempt_number`,
    [registrationId]
  );
  assert.deepEqual(history.rows.map((attempt) => attempt.status), ['EMAIL_FAILED', 'EMAIL_SENT']);
  assert.equal(history.rows[0].admin_id, 1);
  assert.equal(history.rows[1].provider_response, '250 accepted');

  const target = new Date('2026-10-09T14:20:00.000Z');
  const window = roomEmailService.getRoomEmailWindow(
    { date: '2026-10-09', start_time: '08:00 PM' },
    target
  );
  assert.equal(window.allowed, true);
  assert.equal(window.targetTime.toISOString(), target.toISOString());
  assert.equal(roomEmailService.getRoomEmailWindow(
    { date: '2026-10-09', start_time: '08:00 PM' },
    new Date('2026-10-09T14:10:00.000Z')
  ).allowed, false);
  await pool.end();
});
