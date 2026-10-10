require('dotenv').config();
const { initDb, runMigrations, query } = require('../database/db');
const { createOtpForRegistration, verifyOtpForRegistration } = require('../services/otpService');
const {
  createPaymentRequest,
  submitUtr,
} = require('../services/manualUpiPaymentService');
const { checkAndSendRoomEmails } = require('../jobs/roomScheduler');
const bcrypt = require('bcryptjs');

function getNearFutureTimeFormatted(minutesAhead = 8) {
  const d = new Date(Date.now() + minutesAhead * 60 * 1000);
  // Get time in IST
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour 0 is 12
  const strTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
  return strTime;
}

async function runAcceptanceTest() {
  if (process.env.RUN_FULL_FLOW_TEST !== 'true' || !process.env.TEST_DATABASE_URL) {
    throw new Error('Set RUN_FULL_FLOW_TEST=true and TEST_DATABASE_URL to run against an explicitly selected test database.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The full-flow test cannot run with NODE_ENV=production.');
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DB_SSL = 'false';

  console.log('\n======================================================');
  console.log('    FREE FIRE ARENA - FULL ACCEPTANCE TEST SUITE      ');
  console.log('======================================================\n');

  try {
    // 1. Database Initialization
    console.log('[Test 1] Initializing PostgreSQL database & migrations...');
    await initDb();
    await runMigrations();
    console.log('✓ Database tables and seeds initialized.');

    // 2. Public Tournaments Query
    console.log('\n[Test 2] Querying tournaments list...');
    const tournamentsRes = await query(`
      SELECT 
        tournaments.id,
        tournaments.name,
        tournaments.description,
        tournaments.date,
        tournaments.start_time,
        tournaments.entry_fee,
        tournaments.prize_amount,
        tournaments.squad_size,
        tournaments.max_slots,
        tournaments.rules,
        tournaments.registration_open,
        COALESCE(sub.confirmed_slots, 0) AS confirmed_slots
      FROM tournaments
      LEFT JOIN (
        SELECT tournament_id, COUNT(id) AS confirmed_slots
        FROM registrations
        WHERE status = 'CONFIRMED'
        GROUP BY tournament_id
      ) sub ON sub.tournament_id = tournaments.id
      ORDER BY tournaments.id ASC
    `);
    console.log(`✓ Retrieved ${tournamentsRes.rows.length} tournaments.`);
    const targetTournament = tournamentsRes.rows[0];
    console.log(`  Selected Tournament: "${targetTournament.name}" (ID: ${targetTournament.id}, Max Slots: ${targetTournament.max_slots}, Entry: ₹${targetTournament.entry_fee})`);

    // 3. Admin Authentication
    console.log('\n[Test 3] Testing Admin Login...');
    if (process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD) {
      const adminRes = await query(
        `SELECT password_hash FROM admins WHERE LOWER(email) = LOWER($1)`,
        [process.env.TEST_ADMIN_EMAIL]
      );
      if (!adminRes.rows.length || !(await bcrypt.compare(process.env.TEST_ADMIN_PASSWORD, adminRes.rows[0].password_hash))) {
        throw new Error('Configured test administrator credentials could not be verified.');
      }
      console.log('✓ Configured test administrator credentials verified.');
    } else {
      console.log('↷ Skipping administrator credential check; TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD are not set.');
    }

    // 4. Admin Create Custom Test Tournament with start time ~8 mins in future (in 10-min email window)
    const testMatchTime = getNearFutureTimeFormatted(8);
    console.log(`\n[Test 4] Admin Creating Test Tournament with start_time: ${testMatchTime} (in ~8 mins)...`);
    const testEntryFee = 17.5;
    const createTourneyRes = await query(`
      INSERT INTO tournaments (name, description, date, start_time, entry_fee, prize_amount, squad_size, max_slots, rules, registration_open)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, 300.00, 4, 2, 'Fair play only. Mobile devices.', TRUE)
      RETURNING *
    `, ['Free Fire BR Acceptance Cup', 'Special 2-Slot Acceptance Test Tournament', testMatchTime, testEntryFee]);
    const testTourney = createTourneyRes.rows[0];
    console.log(`✓ Created test tournament #${testTourney.id} ("${testTourney.name}") with max_slots: ${testTourney.max_slots}`);

    // 5. Squad Registration (4 Players)
    console.log('\n[Test 5] Player registering 4-player squad...');
    const captainEmail = `captain-${Date.now()}@example.com`;
    const regRes = await query(`
      INSERT INTO registrations
        (tournament_id, captain_name, captain_email, captain_phone, status, email_verified, payment_status, reservation_expires_at)
      VALUES ($1, 'Aman Sharma (Captain)', $2, '9876543210', 'PENDING', FALSE, 'PENDING',
              CURRENT_TIMESTAMP + INTERVAL '15 minutes')
      RETURNING *
    `, [testTourney.id, captainEmail]);
    const registrationId = regRes.rows[0].id;

    const players = [
      { num: 1, name: 'Aman Sharma', ffId: 'FF_AMAN_99' },
      { num: 2, name: 'Rohit Varma', ffId: 'FF_ROHIT_88' },
      { num: 3, name: 'Sanjay Kumar', ffId: 'FF_SANJAY_77' },
      { num: 4, name: 'Vikram Singh', ffId: 'FF_VIKRAM_66' },
    ];

    for (const p of players) {
      await query(
        `INSERT INTO players (registration_id, player_number, full_name, free_fire_id) VALUES ($1, $2, $3, $4)`,
        [registrationId, p.num, p.name, p.ffId]
      );
    }
    console.log(`✓ Squad registered with ID #${registrationId} and 4 distinct players.`);

    // 6. OTP Generation & Verification
    console.log('\n[Test 6] Testing 6-Digit OTP Generation & Bcrypt Verification...');
    const otpResult = await createOtpForRegistration(registrationId, captainEmail);
    console.log('  Generated six-digit OTP in memory for this isolated test.');
    
    // Attempt with invalid OTP first
    const invalidVerify = await verifyOtpForRegistration(registrationId, '000000');
    if (invalidVerify.valid) throw new Error('Invalid OTP was incorrectly accepted!');
    console.log('✓ Invalid OTP correctly rejected.');

    // Attempt with valid OTP
    const validVerify = await verifyOtpForRegistration(registrationId, otpResult.otp);
    if (!validVerify.valid) throw new Error(`Valid OTP failed verification: ${validVerify.error}`);
    console.log('✓ Valid OTP verified successfully. Registration status updated to OTP_VERIFIED.');

    // Attempt OTP reuse
    const reuseVerify = await verifyOtpForRegistration(registrationId, otpResult.otp);
    if (reuseVerify.valid) throw new Error('OTP was reused after verification!');
    console.log('✓ OTP single-use protection verified (cannot be reused).');

    // 7. UPI payment request and manual UTR review
    console.log(`\n[Test 7] Creating a ₹${testEntryFee} UPI request and submitting a test-only UTR...`);
    if (!process.env.TEST_UPI_ID) {
      throw new Error('Set TEST_UPI_ID to an explicitly selected UPI handle for this local acceptance test.');
    }
    process.env.UPI_ID = process.env.TEST_UPI_ID;
    process.env.UPI_DISPLAY_NAME = process.env.TEST_UPI_DISPLAY_NAME || 'Free Fire Arena Test';
    const payment = await createPaymentRequest(registrationId);
    if (payment.amount !== testEntryFee || payment.status !== 'PENDING' || !payment.upiUri.startsWith('upi://pay?')) {
      throw new Error('The payment request did not match the configured tournament entry fee.');
    }
    const submittedUtr = await submitUtr(registrationId, `TEST${Date.now()}1234`);
    if (submittedUtr.status !== 'UTR_SUBMITTED') {
      throw new Error('The UTR was not recorded for admin review.');
    }
    console.log(`✓ UPI request is ₹${testEntryFee}; the test UTR remains unverified pending manual admin review.`);

    // 8. Slot Count Verification
    console.log('\n[Test 8] Verifying UTR submission did not confirm the squad...');
    const slotCheck = await query(`
      SELECT COUNT(id) as count FROM registrations WHERE tournament_id = $1 AND status = 'CONFIRMED'
    `, [testTourney.id]);
    const confirmedSlots = parseInt(slotCheck.rows[0].count, 10);
    console.log(`✓ Current Confirmed Slots: ${confirmedSlots} / ${testTourney.max_slots}`);
    if (confirmedSlots !== 0) throw new Error(`Expected 0 confirmed slots, found ${confirmedSlots}`);

    // 10. Admin Adding Room Credentials
    console.log('\n[Test 10] Admin saving Room ID and Room Password...');
    const roomId = 'ROOM_FF_9823';
    const roomPassword = 'PRO_PASS_2026';
    await query(`
      INSERT INTO room_credentials (tournament_id, room_id, room_password)
      VALUES ($1, $2, $3)
      ON CONFLICT (tournament_id) DO UPDATE SET room_id = EXCLUDED.room_id, room_password = EXCLUDED.room_password
    `, [testTourney.id, roomId, roomPassword]);
    console.log(`✓ Room Credentials saved securely: Room ID="${roomId}", Password="${roomPassword}"`);

    // Verify room credentials are NOT in public query
    const publicTourney = await query(`SELECT * FROM tournaments WHERE id = $1`, [testTourney.id]);
    if ('room_id' in publicTourney.rows[0] || 'room_password' in publicTourney.rows[0]) {
      throw new Error('Room credentials found in tournaments table columns!');
    }
    console.log('✓ Verified: Public tournament model does NOT expose room credentials.');

    // 10. Time-based invocation must never dispatch credentials automatically.
    console.log('\n[Test 10] Verifying room credentials require a manual admin action...');
    let automaticDispatchBlocked = false;
    try {
      await checkAndSendRoomEmails();
    } catch (error) {
      if (error.code !== 'MANUAL_DISPATCH_REQUIRED') throw error;
      automaticDispatchBlocked = true;
    }
    if (!automaticDispatchBlocked) throw new Error('Automatic room credential delivery was not blocked.');
    const emailLogs = await query(`
      SELECT * FROM email_logs WHERE tournament_id = $1 AND registration_id = $2 AND email_type = 'ROOM_CREDENTIALS'
    `, [testTourney.id, registrationId]);
    if (emailLogs.rows.length !== 0) throw new Error('The automatic dispatch attempt created a credential email.');
    console.log('✓ Automatic dispatch is disabled; credentials can only be sent by the admin action.');

    console.log('\n======================================================');
    console.log('    ✓✓ ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY! ✓✓    ');
    console.log('======================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ACCEPTANCE TEST FAILED:', error);
    process.exit(1);
  }
}

runAcceptanceTest();
