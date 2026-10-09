const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../database/db');
const { getSessionSecret } = require('../middleware/authMiddleware');

const ADMIN_COOKIE_NAME = 'ffa_admin_token';
const ADMIN_SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

// POST /api/admin/login
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required.',
    });
  }

  try {
    const adminRes = await query(
      `SELECT * FROM admins WHERE LOWER(email) = LOWER($1)`,
      [email.trim()]
    );

    if (adminRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const admin = adminRes.rows[0];
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: 'admin',
      },
      getSessionSecret(),
      { expiresIn: '24h' }
    );
    res.cookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ADMIN_SESSION_MAX_AGE,
      path: '/api/admin',
    });

    return res.json({
      success: true,
      message: 'Admin login successful.',
      token,
      admin: {
        id: admin.id,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error('[AdminAuthController] login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login failed due to a server error.',
    });
  }
}

// POST /api/admin/logout
async function logout(req, res) {
  res.clearCookie(ADMIN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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
  login,
  logout,
  getMe,
};
