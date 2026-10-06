const http = require('http');

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
  console.log('    RUNNING END-TO-END HTTP API SUITE (PORT 5000)     ');
  console.log('======================================================\n');

  try {
    // 1. Health Check
    console.log('[E2E 1] Checking API Health...');
    const health = await makeRequest({
      hostname: 'localhost',
      port: 5000,
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
      port: 5000,
      path: '/api/tournaments',
      method: 'GET',
    });
    console.log(`✓ Status ${tourneys.status}. Found ${tourneys.body.tournaments?.length} tournaments.`);
    if (tourneys.status !== 200 || !tourneys.body.tournaments) {
      throw new Error('Failed to fetch tournaments');
    }

    const testTourney = tourneys.body.tournaments[0];
    const initialConfirmed = testTourney.confirmedSlots;
    console.log(`  Target Match: "${testTourney.name}" (#${testTourney.id}), Confirmed Slots: ${initialConfirmed}/${testTourney.maxSlots}`);

    // 3. Submit Squad Registration (4 Players)
    console.log('\n[E2E 3] Submitting 4-Player Squad Registration...');
    const regPayload = {
      tournamentId: testTourney.id,
      captainName: 'Aman Sharma',
      captainEmail: `captain_${Date.now()}@arena.com`,
      captainPhone: '9876543210',
      captainFreeFireId: `FF_AMAN_${Date.now()}`,
      players: [
        { fullName: 'Aman Sharma', freeFireId: `FF_AMAN_${Date.now()}` },
        { fullName: 'Rohit Varma', freeFireId: `FF_ROHIT_${Date.now()}` },
        { fullName: 'Sanjay Kumar', freeFireId: `FF_SANJAY_${Date.now()}` },
        { fullName: 'Vikram Singh', freeFireId: `FF_VIKRAM_${Date.now()}` },
      ],
    };

    const regResponse = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/registrations',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, regPayload);

    console.log(`✓ Status ${regResponse.status}:`, regResponse.body);
    if (regResponse.status !== 201 || !regResponse.body.registrationId) {
      throw new Error('Registration submission failed');
    }
    const registrationId = regResponse.body.registrationId;
    const testOtpCode = regResponse.body.devOtp;

    // 4. Verify OTP on HTTP endpoint
    console.log(`\n[E2E 4] Verifying 6-Digit OTP (${testOtpCode}) for Registration #${registrationId}...`);
    const verifyOtpRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/registrations/${registrationId}/verify-otp`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { otp: testOtpCode });

    console.log(`✓ Status ${verifyOtpRes.status}:`, verifyOtpRes.body);
    if (verifyOtpRes.status !== 200 || !verifyOtpRes.body.success) {
      throw new Error('OTP verification endpoint failed');
    }

    // 5. Payment Order Creation
    console.log('\n[E2E 5] Creating Razorpay Payment Order (₹40)...');
    const orderRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/payments/create-order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { registrationId });

    console.log(`✓ Status ${orderRes.status}:`, orderRes.body);
    if (orderRes.status !== 200 || !orderRes.body.orderId || orderRes.body.amount !== 40) {
      throw new Error('Payment order creation failed');
    }

    // 6. Payment Signature Verification
    console.log('\n[E2E 6] Verifying Payment Signature on Server...');
    const verifyPayRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/payments/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      registrationId,
      razorpay_order_id: orderRes.body.orderId,
      razorpay_payment_id: `pay_e2e_${Date.now()}`,
      razorpay_signature: 'verified_dev',
    });

    console.log(`✓ Status ${verifyPayRes.status}:`, verifyPayRes.body);
    if (verifyPayRes.status !== 200 || verifyPayRes.body.status !== 'CONFIRMED') {
      throw new Error('Payment signature verification failed');
    }

    // 7. Check Slot Count Updated
    console.log('\n[E2E 7] Checking Tournament Slot Count Updated...');
    const updatedTourneyRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/tournaments/${testTourney.id}`,
      method: 'GET',
    });
    console.log(`✓ Tournament Details: Confirmed Slots: ${updatedTourneyRes.body.tournament?.confirmedSlots}/${updatedTourneyRes.body.tournament?.maxSlots}`);
    if (updatedTourneyRes.body.tournament.confirmedSlots !== initialConfirmed + 1) {
      throw new Error('Slot count did not increment!');
    }

    // 8. Admin Authentication
    console.log('\n[E2E 8] Admin Login...');
    const adminLoginRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      email: 'admin@freefirearena.com',
      password: 'admin123456',
    });
    console.log(`✓ Admin Login Status ${adminLoginRes.status}:`, adminLoginRes.body.message);
    if (adminLoginRes.status !== 200 || !adminLoginRes.body.token) {
      throw new Error('Admin login failed');
    }
    const adminToken = adminLoginRes.body.token;

    // 9. Admin Stats
    console.log('\n[E2E 9] Fetching Admin Dashboard Stats...');
    const statsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/stats',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    console.log(`✓ Stats Status ${statsRes.status}:`, statsRes.body.stats);

    // 10. Save Room Credentials
    console.log('\n[E2E 10] Admin Saving Custom Room Credentials...');
    const saveRoomRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/tournaments/${testTourney.id}/room`,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
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
      port: 5000,
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
      port: 5000,
      path: `/api/admin/tournaments/${testTourney.id}/send-room-emails`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    console.log(`✓ Dispatch Status ${dispatchRes.status}:`, dispatchRes.body);

    // 13. Trigger again to verify duplicate protection
    console.log('\n[E2E 13] Triggering dispatch again to verify Duplicate Protection...');
    const dispatchAgainRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/tournaments/${testTourney.id}/send-room-emails`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
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
