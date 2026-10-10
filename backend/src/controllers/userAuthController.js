const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { getClient, query } = require('../database/db');
const { getSessionCookie } = require('../middleware/userAuthMiddleware');
const { sendLoginOtpEmail } = require('../services/emailService');
const {
  ManualPaymentError,
  getPaymentStatus,
  submitUtr,
} = require('../services/manualUpiPaymentService');

const OTP_TTL_MINUTES = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const SESSION_TTL_DAYS = 7;

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  };
}

async function requestLoginOtp(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const registrationIntent = req.body?.registrationIntent === true;
  if (!validator.isEmail(email) || email.length > 255) {
    return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
  }

  try {
    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 10);
    const client = await getClient();
    let rateLimited = false;
    let resendCooldownSeconds = 0;
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO email_otp_rate_limits (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
        [email]
      );
      await client.query(`SELECT email FROM email_otp_rate_limits WHERE email = $1 FOR UPDATE`, [email]);
      const recentRequests = await client.query(
        `SELECT id, created_at
         FROM email_login_otps
         WHERE email = $1 AND otp_purpose = 'player'
         ORDER BY created_at DESC, id DESC
         LIMIT 5`,
        [email]
      );
      const recentWithinWindow = recentRequests.rows.filter((row) => (
        Date.now() - new Date(row.created_at).getTime() < 15 * 60 * 1000
      ));
      rateLimited = recentWithinWindow.length >= 5;
      if (recentRequests.rows.length) {
        const elapsedSeconds = Math.floor(
          (Date.now() - new Date(recentRequests.rows[0].created_at).getTime()) / 1000
        );
        resendCooldownSeconds = Math.max(0, OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      }
      if (rateLimited || resendCooldownSeconds > 0) {
        await client.query('ROLLBACK');
      } else {
        await client.query(
          `UPDATE email_login_otps SET consumed_at = CURRENT_TIMESTAMP
           WHERE email = $1 AND otp_purpose = 'player' AND consumed_at IS NULL`,
          [email]
        );
        await client.query(
          `INSERT INTO email_login_otps (email, otp_hash, expires_at, registration_intent, otp_purpose)
           VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '5 minutes', $3, 'player')`,
          [email, otpHash, registrationIntent]
        );
        await client.query('COMMIT');
      }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    if (rateLimited) {
      return res.status(429).json({ success: false, error: 'Too many OTP requests for this email. Try again later.' });
    }
    if (resendCooldownSeconds > 0) {
      return res.status(429).json({
        success: false,
        error: 'Please wait before requesting another code.',
        code: 'OTP_RESEND_COOLDOWN',
        retryAfterSeconds: resendCooldownSeconds,
      });
    }

    await sendLoginOtpEmail(email, otp);
    return res.json({
      success: true,
      message: `A one-time sign-in code has been sent to ${email}.`,
      expiresInSeconds: OTP_TTL_MINUTES * 60,
    });
  } catch (error) {
    console.error('[UserAuth] OTP request/delivery failed:', error);
    return res.status(502).json({ success: false, error: 'Unable to send the sign-in code. Please try again later.' });
  }
}

async function verifyLoginOtp(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
  if (!validator.isEmail(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, error: 'Enter a valid email and 6-digit code.' });
  }

  const client = await getClient();
  let sessionToken;
  let authenticatedEmail = email;
  try {
    await client.query('BEGIN');
    const otpResult = await client.query(
      `SELECT id, otp_hash, expires_at, attempts, consumed_at, registration_intent
       FROM email_login_otps
       WHERE email = $1 AND otp_purpose = 'player'
       ORDER BY created_at DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [email]
    );
    const record = otpResult.rows[0];
    if (!record || record.consumed_at || new Date(record.expires_at) <= new Date() || record.attempts >= 5) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'This code is invalid or expired. Request a new code.' });
    }

    await client.query(`UPDATE email_login_otps SET attempts = attempts + 1 WHERE id = $1`, [record.id]);
    if (!(await bcrypt.compare(otp, record.otp_hash))) {
      await client.query('COMMIT');
      return res.status(400).json({ success: false, error: 'The code is incorrect. Check it and try again.' });
    }

    const account = await client.query(
      `SELECT email FROM email_users WHERE LOWER(email) = $1 ORDER BY email LIMIT 1`,
      [email]
    );
    const existingCaptain = await client.query(
      `SELECT captain_email FROM registrations
       WHERE LOWER(captain_email) = $1
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    if (!account.rows.length && !existingCaptain.rows.length && !record.registration_intent) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_NOT_REGISTERED',
        error: 'No player account exists for this email. Choose Create account and verify a new code.',
      });
    }
    await client.query(
      `UPDATE email_login_otps SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1 AND consumed_at IS NULL`,
      [record.id]
    );
    if (account.rows.length) {
      authenticatedEmail = account.rows[0].email;
      await client.query(
        `UPDATE email_users SET last_login_at = CURRENT_TIMESTAMP WHERE LOWER(email) = $1`,
        [email]
      );
    } else if (record.registration_intent || existingCaptain.rows.length) {
      await client.query(
        `INSERT INTO email_users (email) VALUES ($1)`,
        [email]
      );
    } else {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_NOT_REGISTERED',
        error: 'No player account exists for this email. Choose Create account and verify a new code.',
      });
    }
    sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    await client.query(
      `INSERT INTO user_sessions (email, token_hash, expires_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '7 days')`,
      [authenticatedEmail, sessionHash]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[UserAuth] OTP verification failed:', error);
    return res.status(500).json({ success: false, error: 'Unable to verify the sign-in code.' });
  } finally {
    client.release();
  }

  res.cookie('ffa_user_session', sessionToken, sessionCookieOptions());
  return res.json({ success: true, user: { email: authenticatedEmail } });
}

async function getUserProfile(req, res) {
  return res.json({ success: true, user: { email: req.user.email } });
}

async function logoutUser(req, res) {
  const token = getSessionCookie(req);
  let logoutError = null;
  try {
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await query(`DELETE FROM user_sessions WHERE token_hash = $1`, [tokenHash]);
    }
  } catch (error) {
    logoutError = error;
    console.error('[UserAuth] Session revocation failed:', error);
  }
  res.clearCookie('ffa_user_session', sessionCookieOptions());
  if (logoutError) {
    return res.status(500).json({ success: false, error: 'Session cookie cleared, but server-side session revocation failed.' });
  }
  return res.json({ success: true });
}

async function getUserDashboard(req, res) {
  try {
    const registrations = await query(
      `SELECT r.id, r.tournament_id, r.status, r.payment_status, r.squad_number,
              r.created_at, t.name AS tournament_name, t.date AS tournament_date,
              t.start_time AS tournament_start_time, t.entry_fee, t.tournament_status,
              tr.placement AS squad_placement, tr.prize_amount AS result_prize_amount,
              tr.details AS result_details,
              CASE WHEN el.status IN ('EMAIL_SENT', 'SENT') THEN 'EMAIL_SENT'
                   WHEN el.status IN ('EMAIL_FAILED', 'FAILED') THEN 'EMAIL_FAILED'
                   WHEN el.status = 'EMAIL_PENDING' THEN 'EMAIL_PENDING'
                   ELSE NULL END AS room_email_status,
              CASE WHEN r.status = 'CONFIRMED' AND el.status IN ('EMAIL_SENT', 'SENT')
                   THEN rc.room_id ELSE NULL END AS room_id,
              CASE WHEN r.status = 'CONFIRMED' AND el.status IN ('EMAIL_SENT', 'SENT')
                   THEN rc.room_password ELSE NULL END AS room_password
       FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       LEFT JOIN tournament_results tr
         ON tr.registration_id = r.id
        AND tr.tournament_id = r.tournament_id
        AND tr.status = 'PUBLISHED'
       LEFT JOIN email_logs el
         ON el.registration_id = r.id
        AND el.tournament_id = r.tournament_id
        AND el.email_type = 'ROOM_CREDENTIALS'
       LEFT JOIN room_credentials rc ON rc.tournament_id = r.tournament_id
       WHERE LOWER(r.captain_email) = $1
       ORDER BY r.created_at DESC`,
      [req.user.email]
    );
    const ids = registrations.rows.map((registration) => registration.id);
    const payments = ids.length
      ? await query(
        `SELECT registration_id, utr, submitted_at, status, rejection_reason
         FROM payments
         WHERE registration_id = ANY($1::int[])
         ORDER BY created_at DESC, id DESC`,
        [ids]
      )
      : { rows: [] };
    const paymentByRegistration = new Map();
    for (const payment of payments.rows) {
      if (!paymentByRegistration.has(payment.registration_id)) {
        paymentByRegistration.set(payment.registration_id, payment);
      }
    }
    const players = ids.length
      ? await query(
        `SELECT registration_id, player_number, full_name, free_fire_id
         FROM players WHERE registration_id = ANY($1::int[])
         ORDER BY registration_id, player_number`,
        [ids]
      )
      : { rows: [] };
    const playersByRegistration = new Map();
    for (const player of players.rows) {
      const team = playersByRegistration.get(player.registration_id) || [];
      team.push(player);
      playersByRegistration.set(player.registration_id, team);
    }
    return res.json({
      success: true,
      registrations: registrations.rows.map((registration) => ({
        ...registration,
        utr: paymentByRegistration.get(registration.id)?.utr || null,
        payment_submitted_at: paymentByRegistration.get(registration.id)?.submitted_at || null,
        payment_status_detail: paymentByRegistration.get(registration.id)?.status || null,
        rejection_reason: paymentByRegistration.get(registration.id)?.rejection_reason || null,
        players: playersByRegistration.get(registration.id) || [],
      })),
    });
  } catch (error) {
    console.error('[UserAuth] Dashboard query failed:', error);
    return res.status(500).json({ success: false, error: 'Unable to load your tournament dashboard.' });
  }
}

async function getOwnedPaymentStatus(req, res) {
  const registrationId = Number(req.params.registrationId);
  if (!Number.isSafeInteger(registrationId) || registrationId < 1) {
    return res.status(400).json({ success: false, error: 'A valid registration is required.' });
  }
  try {
    const owner = await query(
      `SELECT id FROM registrations
       WHERE id = $1 AND LOWER(captain_email) = LOWER($2)`,
      [registrationId, req.user.email]
    );
    if (!owner.rows.length) return res.status(404).json({ success: false, error: 'Registration not found.' });
    const payment = await getPaymentStatus(registrationId);
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found.' });
    return res.json({ success: true, payment });
  } catch (error) {
    if (!(error instanceof ManualPaymentError)) {
      console.error('[UserAuth] Owned payment status failed:', error);
      return res.status(500).json({ success: false, error: 'Unable to load payment details.' });
    }
    return res.status(error.status).json({ success: false, error: error.message, code: error.code });
  }
}

async function submitOwnedUtr(req, res) {
  const registrationId = Number(req.params.registrationId);
  if (!Number.isSafeInteger(registrationId) || registrationId < 1) {
    return res.status(400).json({ success: false, error: 'A valid registration is required.' });
  }
  try {
    const owner = await query(
      `SELECT id FROM registrations
       WHERE id = $1 AND LOWER(captain_email) = LOWER($2)`,
      [registrationId, req.user.email]
    );
    if (!owner.rows.length) return res.status(404).json({ success: false, error: 'Registration not found.' });
    const payment = await submitUtr(registrationId, req.body?.utr);
    return res.json({ success: true, message: 'Payment submitted for admin verification.', payment });
  } catch (error) {
    if (!(error instanceof ManualPaymentError)) {
      console.error('[UserAuth] Owned UTR submission failed:', error);
      return res.status(500).json({ success: false, error: 'Unable to submit payment reference.' });
    }
    return res.status(error.status).json({ success: false, error: error.message, code: error.code });
  }
}

module.exports = {
  requestLoginOtp,
  verifyLoginOtp,
  getUserProfile,
  logoutUser,
  getUserDashboard,
  getOwnedPaymentStatus,
  submitOwnedUtr,
};
