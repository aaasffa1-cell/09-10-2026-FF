const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../database/db');

function getSessionSecret() {
  const configuredSecret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production' && !configuredSecret) {
    throw new Error('SESSION_SECRET is required in production.');
  }
  return configuredSecret || 'local-development-only-session-secret';
}

function getCookieToken(req, cookieName) {
  const cookieHeader = req.headers.cookie || '';
  const prefix = `${cookieName}=`;
  const cookie = cookieHeader.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : getCookieToken(req, 'ffa_admin_token');
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing or invalid authentication token.',
      });
    }

    const decoded = jwt.verify(token, getSessionSecret());
    if (!decoded || decoded.role !== 'admin' || !Number.isSafeInteger(Number(decoded.id))) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid administrator session.',
      });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const authorizedAdmins = await query(
      `SELECT a.id, a.email
       FROM admins a
       JOIN admin_sessions s ON s.admin_id = a.id
       WHERE s.token_hash = $1 AND s.expires_at > $2
       LIMIT 2`,
      [tokenHash, new Date()]
    );
    const adminCount = await query(`SELECT id FROM admins ORDER BY id LIMIT 2`);
    if (adminCount.rows.length !== 1 || authorizedAdmins.rows.length !== 1 ||
        Number(authorizedAdmins.rows[0].id) !== Number(decoded.id) ||
        authorizedAdmins.rows[0].email.toLowerCase() !== String(decoded.email || '').toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Administrator access is unavailable until exactly one authorized admin account is configured.',
      });
    }
    req.admin = decoded;
    req.adminSessionToken = token;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please log in again.',
      });
    }
    if (error.name !== 'JsonWebTokenError' && error.name !== 'NotBeforeError') {
      console.error('[AdminAuth] Session validation failed:', error);
      return res.status(503).json({
        success: false,
        error: 'Unable to validate administrator session.',
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid token.',
    });
  }
}

module.exports = {
  requireAdminAuth,
  getSessionSecret,
};
