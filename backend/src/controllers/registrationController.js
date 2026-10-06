const { query, getClient } = require('../database/db');
const { createOtpForRegistration, verifyOtpForRegistration } = require('../services/otpService');
const { sendOtpEmail } = require('../services/emailService');

// POST /api/registrations - Step 1: Submit Squad & Generate OTP
async function createRegistration(req, res) {
  const { tournamentId, captainName, captainEmail, captainPhone, captainFreeFireId, players } = req.body;

  let client;
  try {
    client = await getClient();
    await client.query('BEGIN');

    // 1. Fetch tournament details & verify status
    const tourneyRes = await client.query(
      `SELECT tournaments.*, COALESCE(sub.confirmed_slots, 0) as confirmed_slots
       FROM tournaments
       LEFT JOIN (
         SELECT tournament_id, COUNT(id) as confirmed_slots
         FROM registrations
         WHERE status = 'CONFIRMED'
         GROUP BY tournament_id
       ) sub ON sub.tournament_id = tournaments.id
       WHERE tournaments.id = $1`,
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

    const confirmedCount = parseInt(tournament.confirmed_slots || '0', 10);
    if (confirmedCount >= tournament.max_slots) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'All slots for this tournament are full.' });
    }

    // 2. Check if captain already has a CONFIRMED registration for this tournament
    const existingConfirmed = await client.query(
      `SELECT id FROM registrations 
       WHERE tournament_id = $1 AND captain_email = $2 AND status = 'CONFIRMED'`,
      [tournamentId, captainEmail]
    );

    if (existingConfirmed.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'A confirmed squad with this captain email already exists for this tournament.' 
      });
    }

    // 3. Insert registration record
    const regRes = await client.query(
      `INSERT INTO registrations (tournament_id, captain_name, captain_email, captain_phone, status, email_verified, payment_status)
       VALUES ($1, $2, $3, $4, 'PENDING', FALSE, 'PENDING')
       RETURNING id, tournament_id, captain_name, captain_email, captain_phone, status, created_at`,
      [tournamentId, captainName, captainEmail, captainPhone]
    );

    const registrationId = regRes.rows[0].id;

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

    // 5. Generate and send 6-digit OTP to Captain Email
    const otpResult = await createOtpForRegistration(registrationId, captainEmail);

    try {
      await sendOtpEmail(captainEmail, otpResult.otp, tournament.name, captainName);
    } catch (emailErr) {
      console.warn('[RegistrationController] OTP Email warning:', emailErr.message);
    }

    return res.status(201).json({
      success: true,
      registrationId,
      status: 'PENDING',
      captainEmail,
      devOtp: process.env.NODE_ENV !== 'production' ? otpResult.otp : undefined,
      message: `Squad registration initiated. A 6-digit verification OTP has been sent to ${captainEmail}.`,
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
  const { id } = req.params;

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
    await sendOtpEmail(reg.captain_email, otpResult.otp, reg.tournament_name, reg.captain_name);

    return res.json({
      success: true,
      devOtp: process.env.NODE_ENV !== 'production' ? otpResult.otp : undefined,
      message: `A fresh 6-digit OTP has been dispatched to ${reg.captain_email}.`,
    });
  } catch (error) {
    console.error('[RegistrationController] sendOtp error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send verification OTP.',
    });
  }
}

// POST /api/registrations/:id/verify-otp - Step 2: Verify OTP
async function verifyOtp(req, res) {
  const { id } = req.params;
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
  const { id } = req.params;

  try {
    const regRes = await query(
      `SELECT registrations.id, registrations.tournament_id, registrations.captain_name, registrations.captain_email, registrations.captain_phone,
              registrations.status, registrations.email_verified, registrations.payment_status, registrations.created_at,
              tournaments.name as tournament_name, tournaments.date as tournament_date, tournaments.start_time as tournament_start_time,
              tournaments.entry_fee, tournaments.prize_amount, tournaments.squad_size
       FROM registrations
       JOIN tournaments ON registrations.tournament_id = tournaments.id
       WHERE registrations.id = $1`,
      [id]
    );

    if (regRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Registration not found.' });
    }

    const playersRes = await query(
      `SELECT player_number, full_name, free_fire_id
       FROM players
       WHERE registration_id = $1
       ORDER BY player_number ASC`,
      [id]
    );

    return res.json({
      success: true,
      registration: {
        ...regRes.rows[0],
        players: playersRes.rows,
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
