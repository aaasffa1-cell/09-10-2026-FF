const jwt = require('jsonwebtoken');
const validator = require('validator');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getClient, query } = require('../database/db');
const { getSessionSecret } = require('../middleware/authMiddleware');
const { sendLoginOtpEmail } = require('../services/emailService');

const ADMIN_COOKIE_NAME = 'ffa_admin_token';
const ADMIN_SESSION_MAX_AGE = 24 * 60 * 60 * 1000;
const ADMIN_OTP_TTL_MINUTES = 5;
const ADMIN_OTP_RESEND_COOLDOWN_SECONDS = 60;

async function requestOtp(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!validator.isEmail(email) || email.length > 255) {
    return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
  }
  try {
    const admins = await query(`SELECT id, email FROM admins ORDER BY id LIMIT 2`);
    if (admins.rows.length !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Administrator sign-in is unavailable until exactly one admin account is configured.',
      });
    }
    const isAuthorizedEmail = admins.rows[0].email.toLowerCase() === email;
    let otp;
    if (isAuthorizedEmail) {
      otp = String(crypto.randomInt(100000, 1000000));
      const otpHash = await bcrypt.hash(otp, 10);
      const client = await getClient();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO email_otp_rate_limits (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
          [email]
        );
        await client.query(`SELECT email FROM email_otp_rate_limits WHERE email = $1 FOR UPDATE`, [email]);
        const recent = await client.query(
          `SELECT created_at FROM email_login_otps
           WHERE email = $1 AND otp_purpose = 'admin'
           ORDER BY created_at DESC, id DESC LIMIT 5`,
          [email]
        );
        const requestsInWindow = recent.rows.filter((row) => (
          Date.now() - new Date(row.created_at).getTime() < 15 * 60 * 1000
        ));
        if (requestsInWindow.length >= 5) {
          await client.query('ROLLBACK');
          return res.status(429).json({ success: false, error: 'Too many code requests. Try again later.' });
        }
        if (recent.rows.length) {
          const elapsedSeconds = Math.floor((Date.now() - new Date(recent.rows[0].created_at).getTime()) / 1000);
          const retryAfterSeconds = Math.max(0, ADMIN_OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
          if (retryAfterSeconds > 0) {
            await client.query('ROLLBACK');
            return res.status(429).json({
              success: false,
              error: 'Please wait before requesting another code.',
              code: 'OTP_RESEND_COOLDOWN',
              retryAfterSeconds,
            });
          }
        }
        await client.query(
          `UPDATE email_login_otps SET consumed_at = CURRENT_TIMESTAMP
           WHERE email = $1 AND otp_purpose = 'admin' AND consumed_at IS NULL`,
          [email]
        );
        await client.query(
          `INSERT INTO email_login_otps (email, otp_hash, expires_at, otp_purpose)
           VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '5 minutes', 'admin')`,
          [email, otpHash]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
      await sendLoginOtpEmail(email, otp);
    }
    return res.json({
      success: true,
      message: `If this email is authorized, a one-time code has been sent to ${email}.`,
      expiresInSeconds: ADMIN_OTP_TTL_MINUTES * 60,
    });
  } catch (error) {
    console.error('[AdminAuthController] OTP request failed:', error);
    return res.status(502).json({ success: false, error: 'Unable to send the sign-in code.' });
  }
}

async function verifyOtp(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
  if (!validator.isEmail(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, error: 'Enter a valid email and 6-digit code.' });
  }
  const client = await getClient();
  let admin;
  let token;
  try {
    await client.query('BEGIN');
    const otpResult = await client.query(
      `SELECT id, otp_hash, expires_at, attempts, consumed_at
       FROM email_login_otps
       WHERE email = $1 AND otp_purpose = 'admin'
       ORDER BY created_at DESC, id DESC
       LIMIT 1 FOR UPDATE`,
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
    const adminResult = await client.query(`SELECT id, email FROM admins ORDER BY id LIMIT 2`);
    if (adminResult.rows.length !== 1 || adminResult.rows[0].email.toLowerCase() !== email) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, error: 'Administrator access is unavailable.' });
    }
    admin = adminResult.rows[0];
    await client.query(
      `UPDATE email_login_otps SET consumed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND consumed_at IS NULL`,
      [record.id]
    );
    token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' },
      getSessionSecret(),
      { expiresIn: '24h' }
    );
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await client.query(
      `INSERT INTO admin_sessions (admin_id, token_hash, expires_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
      [admin.id, tokenHash]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[AdminAuthController] OTP verification failed:', error);
    return res.status(500).json({ success: false, error: 'Unable to verify the sign-in code.' });
  } finally {
    client.release();
  }
  res.cookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/api/admin',
  });
  return res.json({ success: true, admin: { id: admin.id, email: admin.email } });
}

// POST /api/admin/logout
async function logout(req, res) {
  try {
    if (req.adminSessionToken) {
      const tokenHash = crypto.createHash('sha256').update(req.adminSessionToken).digest('hex');
      await query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [tokenHash]);
    }
  } catch (error) {
    console.error('[AdminAuthController] Session revocation failed:', error);
    return res.status(500).json({ success: false, error: 'Unable to invalidate administrator session.' });
  }
  res.clearCookie(ADMIN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/admin',
  });
  return res.json({
    success: true,
    message: 'Logged out successfully.',
  });
}

// GET /api/admin/me
async function getMe(req, res) {
  try {
    const adminRes = await query(
      `SELECT id, email, created_at FROM admins WHERE id = $1`,
      [req.admin.id]
    );

    if (adminRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Admin account not found.' });
    }

    return res.json({
      success: true,
      admin: adminRes.rows[0],
    });
  } catch (error) {
    console.error('[AdminAuthController] getMe error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch admin profile.',
    });
  }
}

module.exports = {
  requestOtp,
  verifyOtp,
  logout,
  getMe,
};
