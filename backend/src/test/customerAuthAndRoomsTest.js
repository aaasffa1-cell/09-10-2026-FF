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
const { migrateTournamentRemodel } = require('../database/remodelMigration');

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
  const memoryDatabase = newDb({ noAstCoverageCheck: true });
  const Pool = memoryDatabase.adapters.createPg().Pool;
  pool = new Pool();
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  await pool.query(schema);
  await migratePaymentSchema(pool);
  await migrateManualUpiReview(pool);
  await migrateCustomerAuthAndSquads(pool);
  await migrateTournamentRemodel(pool);
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
  await pool.query(`INSERT INTO email_users (email) VALUES ('Captain@Example.com')`);
  sentLoginOtp = null;
  const requestResponse = responseMock();
  await authController.requestLoginOtp({ body: { email: ' Captain@Example.com ' } }, requestResponse);
  assert.equal(requestResponse.statusCode, 200);
  assert.equal(requestResponse.body.expiresInSeconds, 300);
  assert.equal(typeof sentLoginOtp, 'string');
  const captainOtp = sentLoginOtp;
  const otpRow = await pool.query(`SELECT otp_hash, consumed_at FROM email_login_otps WHERE email = $1`, ['captain@example.com']);
  assert.notEqual(otpRow.rows[0].otp_hash, captainOtp);
  assert.equal(await bcrypt.compare(captainOtp, otpRow.rows[0].otp_hash), true);

  const cooldownResponse = responseMock();
  await authController.requestLoginOtp({ body: { email: 'captain@example.com' } }, cooldownResponse);
  assert.equal(cooldownResponse.statusCode, 429);
  assert.equal(cooldownResponse.body.code, 'OTP_RESEND_COOLDOWN');
  assert.ok(cooldownResponse.body.retryAfterSeconds > 0);

  const invalidResponse = responseMock();
  await authController.verifyLoginOtp(
    { body: { email: 'captain@example.com', otp: '000000' } },
    invalidResponse
  );
  assert.equal(invalidResponse.statusCode, 400);

  await pool.query(`INSERT INTO email_users (email) VALUES ('attempts@example.com')`);
  const attemptsOtpResponse = responseMock();
  await authController.requestLoginOtp({ body: { email: 'attempts@example.com' } }, attemptsOtpResponse);
  const attemptsOtp = sentLoginOtp;
  const wrongOtp = attemptsOtp === '000000' ? '000001' : '000000';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failedAttempt = responseMock();
    await authController.verifyLoginOtp(
      { body: { email: 'attempts@example.com', otp: wrongOtp } },
      failedAttempt
    );
    assert.equal(failedAttempt.statusCode, 400);
  }
  const exhaustedCode = await pool.query(
    `SELECT attempts FROM email_login_otps WHERE email = 'attempts@example.com'`
  );
  assert.equal(exhaustedCode.rows[0].attempts, 5);
  const sixthAttempt = responseMock();
  await authController.verifyLoginOtp(
    { body: { email: 'attempts@example.com', otp: sentLoginOtp } },
    sixthAttempt
  );
  assert.equal(sixthAttempt.statusCode, 400);

  const loginResponse = responseMock();
  await authController.verifyLoginOtp(
    { body: { email: 'captain@example.com', otp: captainOtp } },
    loginResponse
  );
  assert.equal(loginResponse.statusCode, 200);
  assert.equal(loginResponse.cookieValue.options.httpOnly, true);
  assert.equal(loginResponse.cookieValue.options.maxAge, undefined);
  const sessionHash = require('node:crypto').createHash('sha256').update(loginResponse.cookieValue.value).digest('hex');
  const session = await pool.query(`SELECT email FROM user_sessions WHERE token_hash = $1`, [sessionHash]);
  assert.equal(session.rows[0].email, 'Captain@Example.com');
  const accounts = await pool.query(
    `SELECT email FROM email_users WHERE LOWER(email) = 'captain@example.com'`
  );
  assert.equal(accounts.rows.length, 1);
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
    { body: { email: 'captain@example.com', otp: captainOtp } },
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
    `INSERT INTO tournaments (name, date, start_time, entry_fee, prize_amount)
     VALUES ('Private Cup', CURRENT_DATE, '08:00 PM', 25, 100) RETURNING id`
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
  assert.equal(dashboardResponse.body.registrations[0].room_password, null);
  const inaccessiblePayment = responseMock();
  await authController.getOwnedPaymentStatus(
    { params: { registrationId: String(ownRegistration.rows[0].id + 1) }, user: { email: 'captain@example.com' } },
    inaccessiblePayment
  );
  assert.equal(inaccessiblePayment.statusCode, 404);

  const adminMiddleware = require('../middleware/authMiddleware');
  const unauthorizedResponse = responseMock();
  await adminMiddleware.requireAdminAuth({ headers: {} }, unauthorizedResponse, () => {});
  assert.equal(unauthorizedResponse.statusCode, 401);
  const adminRow = await pool.query(
    `INSERT INTO admins (email, password_hash) VALUES ('admin@example.com', 'test-hash') RETURNING id`
  );
  const adminToken = jwt.sign(
    { id: adminRow.rows[0].id, email: 'admin@example.com', role: 'admin' },
    adminMiddleware.getSessionSecret()
  );
  const adminTokenHash = require('node:crypto').createHash('sha256').update(adminToken).digest('hex');
  await pool.query(
    `INSERT INTO admin_sessions (admin_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [adminRow.rows[0].id, adminTokenHash, new Date(Date.now() + 60_000)]
  );
  const resultController = require('../controllers/resultController');
  const draftResultResponse = responseMock();
  await resultController.saveTournamentResult(
    {
      params: { tournamentId: String(tournament.rows[0].id) },
      body: { registrationId: ownRegistration.rows[0].id, placement: 1, prizeAmount: 300, details: 'Final standings', publish: false },
      admin: { id: adminRow.rows[0].id },
    },
    draftResultResponse
  );
  assert.equal(draftResultResponse.statusCode, 200);
  const hiddenResultsResponse = responseMock();
  await resultController.getPublishedResults({}, hiddenResultsResponse);
  assert.equal(hiddenResultsResponse.body.results.length, 0);

  const correctionRequiredResponse = responseMock();
  await resultController.saveTournamentResult(
    {
      params: { tournamentId: String(tournament.rows[0].id) },
      body: { registrationId: ownRegistration.rows[0].id, placement: 1, prizeAmount: 300, details: 'Final standings', publish: true },
      admin: { id: adminRow.rows[0].id },
    },
    correctionRequiredResponse
  );
  assert.equal(correctionRequiredResponse.statusCode, 409);
  const publishResultResponse = responseMock();
  await resultController.saveTournamentResult(
    {
      params: { tournamentId: String(tournament.rows[0].id) },
      body: { registrationId: ownRegistration.rows[0].id, placement: 1, prizeAmount: 300, details: 'Final standings', publish: true, confirmCorrection: true },
      admin: { id: adminRow.rows[0].id },
    },
    publishResultResponse
  );
  assert.equal(publishResultResponse.statusCode, 200);
  const publicResultsResponse = responseMock();
  await resultController.getPublishedResults({}, publicResultsResponse);
  assert.equal(publicResultsResponse.body.results.length, 1);
  const resultHistory = await pool.query(
    `SELECT action FROM tournament_result_history WHERE result_id = $1 ORDER BY id`,
    [publishResultResponse.body.result.id]
  );
  assert.deepEqual(resultHistory.rows.map((row) => row.action), ['CREATED', 'CORRECTED']);

  let adminAuthorized = false;
  await adminMiddleware.requireAdminAuth(
    { headers: { authorization: `Bearer ${adminToken}` } },
    responseMock(),
    () => { adminAuthorized = true; }
  );
  assert.equal(adminAuthorized, true);
  const adminAuthController = require('../controllers/adminAuthController');
  await adminAuthController.logout({ adminSessionToken: adminToken }, responseMock());
  let authorizedAfterLogout = false;
  const revokedResponse = responseMock();
  await adminMiddleware.requireAdminAuth(
    { headers: { authorization: `Bearer ${adminToken}` } },
    revokedResponse,
    () => { authorizedAfterLogout = true; }
  );
  assert.equal(authorizedAfterLogout, false);
  assert.equal(revokedResponse.statusCode, 403);

  const adminOtpRequestResponse = responseMock();
  await adminAuthController.requestOtp(
    { body: { email: 'admin@example.com' } },
    adminOtpRequestResponse
  );
  assert.equal(adminOtpRequestResponse.statusCode, 200);
  const adminOtp = sentLoginOtp;
  const adminOtpVerifyResponse = responseMock();
  await adminAuthController.verifyOtp(
    { body: { email: 'admin@example.com', otp: adminOtp } },
    adminOtpVerifyResponse
  );
  assert.equal(adminOtpVerifyResponse.statusCode, 200);
  assert.equal(adminOtpVerifyResponse.cookieValue.options.httpOnly, true);
  let otpAdminAuthorized = false;
  await adminMiddleware.requireAdminAuth(
    { headers: { cookie: `ffa_admin_token=${adminOtpVerifyResponse.cookieValue.value}` } },
    responseMock(),
    () => { otpAdminAuthorized = true; }
  );
  assert.equal(otpAdminAuthorized, true);

  const registrationOtpResponse = responseMock();
  await authController.requestLoginOtp(
    { body: { email: 'new-player@example.com', registrationIntent: true } },
    registrationOtpResponse
  );
  const registrationOtp = sentLoginOtp;
  const registrationLoginResponse = responseMock();
  await authController.verifyLoginOtp(
    { body: { email: 'new-player@example.com', otp: registrationOtp } },
    registrationLoginResponse
  );
  assert.equal(registrationLoginResponse.statusCode, 200);
  const createdAccount = await pool.query(
    `SELECT email FROM email_users WHERE email = 'new-player@example.com'`
  );
  assert.equal(createdAccount.rows.length, 1);
  await pool.end();
});

test('room delivery sends only confirmed squads, records provider failures, and permits retry without duplicate success', async () => {
  await setupDatabase();
  roomEmailAttempts = 0;
  const tournamentResult = await pool.query(
    `INSERT INTO tournaments (name, date, start_time, entry_fee, prize_amount, max_slots)
     VALUES ('Room Test', CURRENT_DATE, '08:00 PM', 25, 100, 13) RETURNING id, name, date, start_time`
  );
  const tournament = tournamentResult.rows[0];
  await pool.query(`INSERT INTO admins (email, password_hash) VALUES ('admin@example.com', 'test-hash')`);
  const roomController = require('../controllers/roomController');
  const saveCredentialsResponse = responseMock();
  await roomController.saveRoomCredentials(
    { params: { id: String(tournament.id) }, body: { roomId: 'ROOM-01', roomPassword: 'PASS-01' }, admin: { id: 1 } },
    saveCredentialsResponse
  );
  assert.equal(saveCredentialsResponse.statusCode, 200);
  const credentialAudit = await pool.query(
    `SELECT action, metadata FROM admin_audit_logs WHERE action = 'ROOM_CREDENTIALS_SAVED'`
  );
  assert.equal(credentialAudit.rows[0].metadata.changed, true);
  assert.equal(JSON.stringify(credentialAudit.rows[0].metadata).includes('PASS-01'), false);
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
  const emailService = require('../services/emailService');
  const roomEmail = emailService.getRoomCredentialsEmailText(
    { captain_name: 'Captain', squad_number: 3 },
    { name: 'Room Test', date: '2026-10-09', start_time: '08:00 PM' },
    'ROOM-01',
    'PASS-01'
  );
  assert.match(roomEmail, /THE TEAM SHOULD GET THEIR PLACES BY GIVEN SQUAD NUMBER ONLY/);
  await pool.end();
});

test('automatic room credential delivery is disabled and admin counters reflect review and delivery states', async () => {
  const roomScheduler = require('../jobs/roomScheduler');
  await assert.rejects(roomScheduler.checkAndSendRoomEmails(), {
    code: 'MANUAL_DISPATCH_REQUIRED',
  });

  await setupDatabase();
  const tournament = await pool.query(
    `INSERT INTO tournaments (name, date, start_time, entry_fee, prize_amount, tournament_status)
     VALUES ('Dashboard Cup', DATE '2099-12-31', '08:00 PM', 45, 200, 'ACTIVE')
     RETURNING id`
  );
  const registration = await pool.query(
    `INSERT INTO registrations
       (tournament_id, captain_name, captain_email, captain_phone, status, payment_status)
     VALUES ($1, 'Captain', 'dashboard@example.com', '1234567890', 'PAYMENT_PENDING', 'UTR_SUBMITTED')
     RETURNING id`,
    [tournament.rows[0].id]
  );
  await pool.query(
    `INSERT INTO payments (registration_id, tournament_id, order_id, amount, status, payment_method, provider)
     VALUES ($1, $2, 'DASHBOARD-UPI-1', 45, 'UTR_SUBMITTED', 'UPI_QR', 'manual_upi')`,
    [registration.rows[0].id, tournament.rows[0].id]
  );
  await pool.query(
    `INSERT INTO email_logs
       (registration_id, tournament_id, email_type, recipient_email, status)
     VALUES ($1, $2, 'ROOM_CREDENTIALS', 'dashboard@example.com', 'EMAIL_SENT')`,
    [registration.rows[0].id, tournament.rows[0].id]
  );
  const adminRegistrationController = require('../controllers/adminRegistrationController');
  const statsResponse = responseMock();
  await adminRegistrationController.getDashboardStats({}, statsResponse);
  assert.equal(statsResponse.statusCode, 200);
  assert.equal(statsResponse.body.stats.totalTeams, 1);
  assert.equal(statsResponse.body.stats.pendingPayments, 1);
  assert.equal(statsResponse.body.stats.totalConfirmedSquads, 0);
  assert.equal(statsResponse.body.stats.upcomingMatches, 1, JSON.stringify(statsResponse.body.stats));
  assert.equal(statsResponse.body.stats.roomEmailsSent, 1);
  assert.equal(statsResponse.body.stats.roomEmailsFailed, 0);
  assert.equal(statsResponse.body.stats.roomEmailsPending, 0);
  const admin = await pool.query(
    `INSERT INTO admins (email, password_hash) VALUES ('audit-admin@example.com', 'test-hash') RETURNING id`
  );
  const adminTournamentController = require('../controllers/adminTournamentController');
  const cancellationResponse = responseMock();
  await adminTournamentController.deleteTournament(
    { params: { id: String(tournament.rows[0].id) }, admin: { id: admin.rows[0].id } },
    cancellationResponse
  );
  assert.equal(cancellationResponse.statusCode, 200);
  assert.equal(cancellationResponse.body.cancelled, true);
  const preserved = await pool.query(
    `SELECT r.status, t.tournament_status, t.registration_open
     FROM registrations r JOIN tournaments t ON t.id = r.tournament_id
     WHERE r.id = $1`,
    [registration.rows[0].id]
  );
  assert.equal(preserved.rows[0].status, 'PAYMENT_PENDING');
  assert.equal(preserved.rows[0].tournament_status, 'CANCELLED');
  assert.equal(preserved.rows[0].registration_open, false);
  const cancellationAudit = await pool.query(
    `SELECT action, admin_id FROM admin_audit_logs
     WHERE action = 'TOURNAMENT_CANCELLED' AND entity_id = $1`,
    [tournament.rows[0].id]
  );
  assert.equal(cancellationAudit.rows[0].admin_id, admin.rows[0].id);
  await pool.end();
});
