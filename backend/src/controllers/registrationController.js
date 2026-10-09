const { query, getClient } = require('../database/db');
const { createOtpForRegistration, verifyOtpForRegistration } = require('../services/otpService');
const { sendOtpEmail } = require('../services/emailService');
const { createRegistrationToken } = require('../middleware/registrationAccessMiddleware');

async function recordOtpEmailAttempt(registrationId, tournamentId, email, status, messageId, errorMessage) {
  try {
    await query(
      `INSERT INTO email_logs (registration_id, tournament_id, email_type, recipient_email, status, provider_message_id, sent_at, last_error)
       VALUES ($1, $2, 'OTP', $3, $4, $5, CASE WHEN $4 = 'SENT' THEN CURRENT_TIMESTAMP ELSE NULL END, $6)
       ON CONFLICT (registration_id, tournament_id, email_type)
       DO UPDATE SET recipient_email = EXCLUDED.recipient_email,
                     status = EXCLUDED.status,
                     provider_message_id = EXCLUDED.provider_message_id,
                     sent_at = EXCLUDED.sent_at,
                     last_error = EXCLUDED.last_error`,
      [registrationId, tournamentId, email, status, messageId || null, errorMessage || null]
    );
  } catch (error) {
    console.error('[RegistrationController] Failed to record OTP email status:', error);
  }
}

// POST /api/registrations - Step 1: Submit Squad & Generate OTP
async function createRegistration(req, res) {
  const { tournamentId, captainName, captainEmail, captainPhone, captainFreeFireId, players } = req.body;
  if (String(req.user.email).toLowerCase() !== String(captainEmail).toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Register using the email address you signed in with.' });
  }

  let client;
  let registrationId;
  const access = createRegistrationToken();
  try {
    client = await getClient();
    await client.query('BEGIN');

    // 1. Fetch tournament details & verify status
    const tourneyRes = await client.query(
      `SELECT * FROM tournaments WHERE id = $1 FOR UPDATE`,
      [tournamentId]
    );

    if (tourneyRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Tournament not found.' });
    }

    const tournament = tourneyRes.rows[0];

    if (!tournament.registration_open) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Registration is closed for this tournament.' });
    }

    const occupiedSlotsRes = await client.query(
      `SELECT COUNT(*)::int AS count FROM registrations
       WHERE tournament_id = $1 AND status = 'CONFIRMED'`,
      [tournamentId]
    );
    const squadCapacity = Math.min(Number(tournament.max_slots), 13);
    if (occupiedSlotsRes.rows[0].count >= squadCapacity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'All slots for this tournament are full.' });
    }

    // 2. Prevent parallel duplicate registrations by reserving against the locked tournament row.
    const existingRegistration = await client.query(
      `SELECT r.id FROM registrations r
       LEFT JOIN payments p
         ON p.registration_id = r.id
        AND p.provider = 'manual_upi'
        AND p.status = 'UTR_SUBMITTED'
       WHERE r.tournament_id = $1 AND r.captain_email = $2
         AND (
           r.status = 'CONFIRMED'
           OR (r.status IN ('PENDING', 'OTP_VERIFIED', 'PAYMENT_PENDING', 'PAYMENT_PROCESSING', 'PAYMENT_FAILED')
               AND r.reservation_expires_at > CURRENT_TIMESTAMP)
           OR (r.status = 'REJECTED' AND r.reservation_expires_at > CURRENT_TIMESTAMP)
           OR p.id IS NOT NULL
         )`,
      [tournamentId, captainEmail]
    );

    if (existingRegistration.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'A confirmed squad with this captain email already exists for this tournament.' 
      });
    }

    // 3. Insert registration record
    const regRes = await client.query(
      `INSERT INTO registrations
         (tournament_id, captain_name, captain_email, captain_phone, status, email_verified, payment_status,
          public_access_token_hash, reservation_expires_at)
       VALUES ($1, $2, $3, $4, 'OTP_VERIFIED', TRUE, 'PENDING', $5, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
       RETURNING id, tournament_id, captain_name, captain_email, captain_phone, status, created_at`,
      [tournamentId, captainName, captainEmail, captainPhone, access.tokenHash]
    );

    registrationId = regRes.rows[0].id;

    // 4. Insert 4 squad players
    // Player 1 is captain
    await client.query(
      `INSERT INTO players (registration_id, player_number, full_name, free_fire_id)
       VALUES ($1, 1, $2, $3)`,
      [registrationId, captainName, captainFreeFireId]
    );

    // Player 2, 3, 4
    for (let i = 1; i < players.length; i++) {
      const p = players[i];
      await client.query(
        `INSERT INTO players (registration_id, player_number, full_name, free_fire_id)
         VALUES ($1, $2, $3, $4)`,
        [registrationId, i + 1, p.fullName, p.freeFireId]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      registrationId,
      registrationToken: access.token,
      status: 'OTP_VERIFIED',
      captainEmail,
      message: 'Squad details saved. Your signed-in email is verified; continue to the UPI payment step.',
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[RegistrationController] createRegistration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create squad registration. Please try again.',
    });
  } finally {
    if (client) client.release();
  }
}

// POST /api/registrations/:id/send-otp - Resend OTP
async function sendOtp(req, res) {
  const id = req.registration.id;

  try {
    const regRes = await query(
      `SELECT registrations.*, tournaments.name as tournament_name
       FROM registrations
       JOIN tournaments ON registrations.tournament_id = tournaments.id
       WHERE registrations.id = $1`,
      [id]
    );

    if (regRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Registration not found.' });
    }

    const reg = regRes.rows[0];

    if (reg.status === 'CONFIRMED') {
      return res.status(400).json({ success: false, error: 'This registration is already confirmed and paid.' });
    }

    const otpResult = await createOtpForRegistration(reg.id, reg.captain_email);
    const mailResult = await sendOtpEmail(reg.captain_email, otpResult.otp, reg.tournament_name, reg.captain_name);
    await recordOtpEmailAttempt(reg.id, reg.tournament_id, reg.captain_email, 'SENT', mailResult.messageId);

    return res.json({
      success: true,
      devOtp: process.env.NODE_ENV !== 'production' ? otpResult.otp : undefined,
      message: `A fresh 6-digit OTP has been dispatched to ${reg.captain_email}.`,
    });
  } catch (error) {
    console.error('[RegistrationController] sendOtp error:', error);
    const regId = Number(id);
    if (Number.isInteger(regId) && regId > 0) {
      const regRes = await query(
        `SELECT tournament_id, captain_email FROM registrations WHERE id = $1`,
        [regId]
      ).catch((lookupError) => {
        console.error('[RegistrationController] Failed to load registration after OTP email error:', lookupError);
        return { rows: [] };
      });
      if (regRes.rows[0]) {
        await recordOtpEmailAttempt(regId, regRes.rows[0].tournament_id, regRes.rows[0].captain_email, 'FAILED', null, error.message);
      }
    }
    return res.status(500).json({
      success: false,
      error: 'Unable to send the OTP email. Please check the email address and try again shortly.',
    });
  }
}

// POST /api/registrations/:id/verify-otp - Step 2: Verify OTP
async function verifyOtp(req, res) {
  const id = req.registration.id;
  const { otp } = req.body;

  if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a valid 6-digit OTP code.',
    });
  }

  try {
    const verification = await verifyOtpForRegistration(id, otp.trim());

    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        error: verification.error,
      });
    }

    // Fetch updated registration
    const regRes = await query(
      `SELECT registrations.id, registrations.tournament_id, registrations.captain_name, registrations.captain_email, registrations.status, registrations.email_verified,
              tournaments.entry_fee, tournaments.name as tournament_name
       FROM registrations
       JOIN tournaments ON registrations.tournament_id = tournaments.id
       WHERE registrations.id = $1`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Email address verified successfully. You may now proceed to entry fee payment.',
      registration: regRes.rows[0],
    });
  } catch (error) {
    console.error('[RegistrationController] verifyOtp error:', error);
    return res.status(500).json({
      success: false,
      error: 'Verification failed. Please try again.',
    });
  }
}

// GET /api/registrations/:id/status - Check status
async function getRegistrationStatus(req, res) {
  const id = req.registration.id;

  try {
    const regRes = await query(
      `SELECT registrations.id, registrations.status, registrations.payment_status,
              tournaments.name as tournament_name
       FROM registrations
       JOIN tournaments ON registrations.tournament_id = tournaments.id
       WHERE registrations.id = $1`,
      [id]
    );

    if (regRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Registration not found.' });
    }

    return res.json({
      success: true,
      registration: {
        ...regRes.rows[0],
      },
    });
  } catch (error) {
    console.error('[RegistrationController] getRegistrationStatus error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve registration status.',
    });
  }
}

module.exports = {
  createRegistration,
  sendOtp,
  verifyOtp,
  getRegistrationStatus,
};
