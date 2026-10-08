const crypto = require('crypto');
const { query } = require('../database/db');

function hashRegistrationToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createRegistrationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashRegistrationToken(token) };
}

async function requireRegistrationAccess(req, res, next) {
  const registrationId = Number(req.params.id || req.params.registrationId || req.body.registrationId);
  const token = req.get('X-Registration-Token');
  if (!Number.isSafeInteger(registrationId) || registrationId < 1 || typeof token !== 'string' || token.length !== 64) {
    return res.status(401).json({ success: false, error: 'Valid registration access is required.' });
  }

  try {
    const result = await query(
      `SELECT id, public_access_token_hash
       FROM registrations WHERE id = $1`,
      [registrationId]
    );
    const storedHash = result.rows[0]?.public_access_token_hash;
    const providedHash = hashRegistrationToken(token);
    if (!storedHash || !/^[a-f0-9]{64}$/i.test(storedHash) ||
        !crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(providedHash, 'hex'))) {
      return res.status(401).json({ success: false, error: 'Valid registration access is required.' });
    }

    req.registration = { id: result.rows[0].id };
    return next();
  } catch (error) {
    console.error('[RegistrationAccess] Failed to validate registration access:', error.message);
    return res.status(500).json({ success: false, error: 'Unable to verify registration access.' });
  }
}

module.exports = {
  createRegistrationToken,
  requireRegistrationAccess,
};
