const jwt = require('jsonwebtoken');

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

function requireAdminAuth(req, res, next) {
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
    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please log in again.',
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
