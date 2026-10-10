const http = require('http');
const TEST_PORT = parseInt(process.env.TEST_PORT || '5000', 10);

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runE2ETests() {
  console.log('\n======================================================');
  console.log(`    RUNNING END-TO-END HTTP API SUITE (PORT ${TEST_PORT})     `);
  console.log('======================================================\n');

  try {
    // 1. Health Check
    console.log('[E2E 1] Checking API Health...');
    const health = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/health',
      method: 'GET',
    });
    console.log(`✓ Health status ${health.status}:`, health.body);
    if (health.status !== 200 || health.body.status !== 'healthy') {
      throw new Error('Health check failed');
    }

    // 2. Public Tournaments
    console.log('\n[E2E 2] Fetching public tournaments list...');
    const tourneys = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/tournaments',
      method: 'GET',
    });
    console.log(`✓ Status ${tourneys.status}. Found ${tourneys.body.tournaments?.length} tournaments.`);
    if (tourneys.status !== 200 || !tourneys.body.tournaments) {
      throw new Error('Failed to fetch tournaments');
    }

    const testTourney = tourneys.body.tournaments[0];
    const initialConfirmed = testTourney.confirmedSlots;
    const runId = Date.now();
    console.log(`  Target Match: "${testTourney.name}" (#${testTourney.id}), Confirmed Slots: ${initialConfirmed}/${testTourney.maxSlots}`);

    // 3. Submit Squad Registration (4 Players)
    console.log('\n[E2E 3] Submitting 4-Player Squad Registration...');
    const regPayload = {
      tournamentId: testTourney.id,
      captainName: 'Aman Sharma',
      captainEmail: `captain_${Date.now()}@arena.com`,
      captainPhone: '9876543210',
      captainFreeFireId: `FF_AMAN_${runId}`,
      players: [
        { fullName: 'Aman Sharma', freeFireId: `FF_AMAN_${runId}` },
        { fullName: 'Rohit Varma', freeFireId: `FF_ROHIT_${runId}` },
        { fullName: 'Sanjay Kumar', freeFireId: `FF_SANJAY_${runId}` },
        { fullName: 'Vikram Singh', freeFireId: `FF_VIKRAM_${runId}` },
      ],
    };

    const regResponse = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/registrations',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, regPayload);

    console.log(`✓ Status ${regResponse.status}:`, {
      success: regResponse.body.success,
      registrationId: regResponse.body.registrationId,
    });
    if (regResponse.status !== 201 || !regResponse.body.registrationId) {
      throw new Error('Registration submission failed');
    }
    const registrationId = regResponse.body.registrationId;
    const registrationToken = regResponse.body.registrationToken;
    if (!registrationToken) throw new Error('Registration access token was not issued.');
    const testOtpCode = regResponse.body.devOtp;

    // 4. Registration status and OTP require the registration's private access token.
    const unauthenticatedStatus = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/registrations/${registrationId}/status`,
      method: 'GET',
    });
    if (unauthenticatedStatus.status !== 401) {
      throw new Error('Registration status exposed private team information without its access token.');
    }

    console.log(`\n[E2E 4] Verifying development OTP for Registration #${registrationId}...`);
    const verifyOtpRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/registrations/${registrationId}/verify-otp`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Registration-Token': registrationToken,
      },
    }, { otp: testOtpCode });

    console.log(`✓ Status ${verifyOtpRes.status}:`, verifyOtpRes.body);
    if (verifyOtpRes.status !== 200 || !verifyOtpRes.body.success) {
      throw new Error('OTP verification endpoint failed');
    }

    // 5. Manual UPI request/UTR never confirms payment automatically.
    console.log('\n[E2E 5] Checking manual UPI payment behavior...');
    const paymentStart = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/payments/registrations/${registrationId}/start`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Registration-Token': registrationToken,
      },
    });

    if (process.env.UPI_ID) {
      if (paymentStart.status !== 200 ||
          Number(paymentStart.body.payment?.amount) !== Number(testTourney.entryFee) ||
          paymentStart.body.payment?.status !== 'PENDING' ||
          !paymentStart.body.payment?.upiUri?.startsWith('upi://pay?')) {
        throw new Error('Configured manual UPI request did not use the selected tournament entry fee.');
      }
      const utrRes = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/payments/registrations/${registrationId}/utr`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Registration-Token': registrationToken,
        },
      }, { utr: `TEST${Date.now()}1234` });
      if (utrRes.status !== 200 || utrRes.body.payment?.status !== 'UTR_SUBMITTED') {
        throw new Error('Test UTR was not stored for manual admin review.');
      }
      const playerPaymentStatus = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/payments/registrations/${registrationId}/status`,
        method: 'GET',
        headers: { 'X-Registration-Token': registrationToken },
      });
      if (playerPaymentStatus.status !== 200 || Object.hasOwn(playerPaymentStatus.body.payment || {}, 'utr')) {
        throw new Error('Player payment status exposed the submitted UTR.');
      }
    } else if (paymentStart.status !== 503 || paymentStart.body.code !== 'UPI_NOT_CONFIGURED') {
      throw new Error('Missing UPI configuration did not fail closed.');
    }

    // 6. Player cannot access admin payment verification.
    const forgedVerifyRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/admin/payments/1/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (forgedVerifyRes.status !== 401) {
      throw new Error('A player request without admin authentication reached payment verification.');
    }

    // 7. Check Slot Count Updated
    console.log('\n[E2E 7] Checking Tournament Slot Count Updated...');
    const updatedTourneyRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/tournaments/${testTourney.id}`,
      method: 'GET',
    });
    console.log(`✓ Tournament Details: Confirmed Slots: ${updatedTourneyRes.body.tournament?.confirmedSlots}/${updatedTourneyRes.body.tournament?.maxSlots}`);
    if (updatedTourneyRes.body.tournament.confirmedSlots !== initialConfirmed) {
      throw new Error('Unverified payment changed the tournament slot count.');
    }

    // 8. Admin Authentication
    console.log('\n[E2E 8] Admin Login...');
    const adminLoginRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    console.log(`✓ Admin Login Status ${adminLoginRes.status}:`, adminLoginRes.body.message);
    if (adminLoginRes.status !== 200 || !adminLoginRes.headers['set-cookie']?.length) {
      throw new Error('Admin login failed');
    }
    const adminCookie = adminLoginRes.headers['set-cookie'][0].split(';')[0];

    if (process.env.UPI_ID) {
      const queueRes = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/admin/payments?status=UTR_SUBMITTED&search=${registrationId}`,
        method: 'GET',
        headers: { Cookie: adminCookie },
      });
      if (queueRes.status !== 200 ||
          !queueRes.body.payments?.some((payment) => payment.registration_id === registrationId)) {
        throw new Error('Admin payment review queue did not contain the submitted UTR.');
      }
    }

    // 9. Admin Stats
    console.log('\n[E2E 9] Fetching Admin Dashboard Stats...');
    const statsRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/admin/stats',
      method: 'GET',
      headers: { 'Cookie': adminCookie },
    });
    console.log(`✓ Stats Status ${statsRes.status}:`, statsRes.body.stats);

    // 10. Save Room Credentials
    console.log('\n[E2E 10] Admin Saving Custom Room Credentials...');
    const saveRoomRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/admin/tournaments/${testTourney.id}/room`,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': adminCookie,
      },
    }, {
      roomId: 'ROOM_99412',
      roomPassword: 'SECRET_PASS_2026',
    });
    console.log(`✓ Save Room Status ${saveRoomRes.status}:`, saveRoomRes.body);

    // 11. Verify Room Credentials NOT Exposed in Public API
    console.log('\n[E2E 11] Verifying Room Credentials NOT in Public API...');
    const publicCheck = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/tournaments/${testTourney.id}`,
      method: 'GET',
    });
    if (publicCheck.body.tournament.roomId || publicCheck.body.tournament.roomPassword) {
      throw new Error('CRITICAL SECURITY LEAK: Room credentials visible in public API!');
    }
    console.log('✓ Public API verified: Room credentials are completely private.');

    // 12. Trigger Room Emails Dispatch
    console.log('\n[E2E 12] Triggering Room Email Dispatch...');
    const dispatchRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/admin/tournaments/${testTourney.id}/send-room-emails`,
      method: 'POST',
      headers: { 'Cookie': adminCookie },
    });
    console.log(`✓ Dispatch Status ${dispatchRes.status}:`, dispatchRes.body);

    // 13. Trigger again to verify duplicate protection
    console.log('\n[E2E 13] Triggering dispatch again to verify Duplicate Protection...');
    const dispatchAgainRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/admin/tournaments/${testTourney.id}/send-room-emails`,
      method: 'POST',
      headers: { 'Cookie': adminCookie },
    });
    console.log(`✓ Duplicate Protection Status: Sent: ${dispatchAgainRes.body.dispatchedCount}, Already Sent: ${dispatchAgainRes.body.alreadySentCount}`);
    if (dispatchAgainRes.body.dispatchedCount !== 0) {
      throw new Error('Duplicate email was sent on second dispatch!');
    }

    console.log('\n======================================================');
    console.log('   ✓✓✓ ALL E2E HTTP INTEGRATION TESTS PASSED! ✓✓✓     ');
    console.log('======================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E TEST FAILED:', error);
    process.exit(1);
  }
}

runE2ETests();
