const crypto = require('crypto');
const { query } = require('../database/db');

function getSessionCookie(req) {
  const prefix = 'ffa_user_session=';
  const entry = (req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch {
    return null;
  }
}

async function requireUserAuth(req, res, next) {
  const token = getSessionCookie(req);
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(401).json({ success: false, error: 'Sign in with your email to continue.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await query(
      `SELECT email, expires_at
       FROM user_sessions
       WHERE token_hash = $1`,
      [tokenHash]
    );
    if (!result.rows.length || new Date(result.rows[0].expires_at) <= new Date()) {
      return res.status(401).json({ success: false, error: 'Your session has expired. Please sign in again.' });
    }
    req.user = { email: result.rows[0].email };
    return next();
  } catch (error) {
    console.error('[UserAuth] Session validation failed:', error);
    return res.status(500).json({ success: false, error: 'Unable to validate your session.' });
  }
}

module.exports = { requireUserAuth, getSessionCookie };
