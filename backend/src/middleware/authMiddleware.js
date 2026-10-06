const jwt = require('jsonwebtoken');

function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing or invalid authentication token.',
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.SESSION_SECRET || 'freefire_arena_default_secret_key';

    const decoded = jwt.verify(token, secret);
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
};
