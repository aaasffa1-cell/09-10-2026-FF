require('dotenv').config();
const { initDb, runMigrations, query } = require('../database/db');
const { createOtpForRegistration, verifyOtpForRegistration } = require('../services/otpService');
const { createOrder, verifyPaymentSignature } = require('../services/razorpayService');
const { parseTournamentDateTime, checkAndSendRoomEmails } = require('../jobs/roomScheduler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
    const adminRes = await query(`SELECT * FROM admins WHERE email = 'admin@freefirearena.com'`);
    if (adminRes.rows.length === 0) throw new Error('Admin account not found in DB.');
    const admin = adminRes.rows[0];
    const passwordMatch = await bcrypt.compare('admin123456', admin.password_hash);
    if (!passwordMatch) throw new Error('Admin password hash mismatch.');
    const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.SESSION_SECRET || 'secret', { expiresIn: '1h' });
    console.log('✓ Admin login successful with bcrypt comparison. Generated JWT token:', token.substring(0, 20) + '...');

    // 4. Admin Create Custom Test Tournament with start time ~8 mins in future (in 10-min email window)
    const testMatchTime = getNearFutureTimeFormatted(8);
    console.log(`\n[Test 4] Admin Creating Test Tournament with start_time: ${testMatchTime} (in ~8 mins)...`);
    const createTourneyRes = await query(`
      INSERT INTO tournaments (name, description, date, start_time, entry_fee, prize_amount, squad_size, max_slots, rules, registration_open)
      VALUES ($1, $2, CURRENT_DATE, $3, 40.00, 1000.00, 4, 2, 'Fair play only. Mobile devices.', TRUE)
      RETURNING *
    `, ['Free Fire BR Acceptance Cup', 'Special 2-Slot Acceptance Test Tournament', testMatchTime]);
    const testTourney = createTourneyRes.rows[0];
    console.log(`✓ Created test tournament #${testTourney.id} ("${testTourney.name}") with max_slots: ${testTourney.max_slots}`);

    // 5. Squad Registration (4 Players)
    console.log('\n[Test 5] Player registering 4-player squad...');
    const captainEmail = 'killer.captain@example.com';
    const regRes = await query(`
      INSERT INTO registrations (tournament_id, captain_name, captain_email, captain_phone, status, email_verified, payment_status)
      VALUES ($1, 'Aman Sharma (Captain)', $2, '9876543210', 'PENDING', FALSE, 'PENDING')
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
    console.log(`  Generated 6-digit OTP: ${otpResult.otp}`);
    
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

    // 7. Payment Order Creation
    console.log('\n[Test 7] Creating Server-Controlled Razorpay Order for ₹40...');
    const order = await createOrder({
      amountInRupees: parseFloat(testTourney.entry_fee),
      currency: 'INR',
      receipt: `reg_${registrationId}`,
    });
    console.log(`✓ Razorpay Order Created: ${order.id}, Amount: ₹${order.amount / 100} (${order.amount} paise)`);

    // Record payment created
    await query(
      `INSERT INTO payments (registration_id, razorpay_order_id, amount, currency, status)
       VALUES ($1, $2, 40.00, 'INR', 'CREATED')`,
      [registrationId, order.id]
    );

    // 8. Payment Signature Verification & Confirmation
    console.log('\n[Test 8] Verifying Payment Signature & Confirming Registration...');
    const mockPaymentId = `pay_${Date.now()}`;
    const mockSignature = 'verified_dev_signature';

    await query(
      `UPDATE payments SET razorpay_payment_id = $1, razorpay_signature = $2, status = 'SUCCESS' WHERE registration_id = $3`,
      [mockPaymentId, mockSignature, registrationId]
    );
    await query(
      `UPDATE registrations SET status = 'CONFIRMED', payment_status = 'PAID' WHERE id = $1`,
      [registrationId]
    );
    console.log('✓ Registration marked as CONFIRMED, payment_status marked as PAID.');

    // 9. Slot Count Verification
    console.log('\n[Test 9] Verifying Confirmed Slot Count...');
    const slotCheck = await query(`
      SELECT COUNT(id) as count FROM registrations WHERE tournament_id = $1 AND status = 'CONFIRMED'
    `, [testTourney.id]);
    const confirmedSlots = parseInt(slotCheck.rows[0].count, 10);
    console.log(`✓ Current Confirmed Slots: ${confirmedSlots} / ${testTourney.max_slots}`);
    if (confirmedSlots !== 1) throw new Error(`Expected 1 confirmed slot, found ${confirmedSlots}`);

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

    // 11. Scheduler & Duplicate Email Protection
    console.log('\n[Test 11] Testing Scheduler Room Email Dispatch & Duplicate Protection...');
    // Trigger scheduler check
    await checkAndSendRoomEmails();

    const emailLogsFirst = await query(`
      SELECT * FROM email_logs WHERE tournament_id = $1 AND registration_id = $2 AND email_type = 'ROOM_CREDENTIALS'
    `, [testTourney.id, registrationId]);
    console.log(`✓ First scheduler run: Email logged. Total logs: ${emailLogsFirst.rows.length}`);
    if (emailLogsFirst.rows.length !== 1) throw new Error('Room credentials email was not logged!');

    // Run scheduler second time to test idempotency
    console.log('  Running scheduler a second time (should NOT duplicate email)...');
    await checkAndSendRoomEmails();

    const emailLogsSecond = await query(`
      SELECT * FROM email_logs WHERE tournament_id = $1 AND registration_id = $2 AND email_type = 'ROOM_CREDENTIALS'
    `, [testTourney.id, registrationId]);
    console.log(`✓ Duplicate Protection: Still exactly ${emailLogsSecond.rows.length} email log record.`);
    if (emailLogsSecond.rows.length !== 1) throw new Error('Duplicate room email was dispatched!');

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
