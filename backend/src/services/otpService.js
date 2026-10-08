const bcrypt = require('bcryptjs');
const { randomInt } = require('crypto');
const { query } = require('../database/db');

const OTP_EXPIRY_MINUTES = 10;
const MAX_VERIFICATION_ATTEMPTS = 5;

// Generate secure 6-digit numeric OTP
function generateOtp() {
  return String(randomInt(100000, 1000000));
}

// Hash OTP with bcrypt (10 rounds)
async function hashOtp(otp) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
}

// Create and store OTP record
async function createOtpForRegistration(registrationId, email) {
  const plainOtp = generateOtp();
  const hashedOtp = await hashOtp(plainOtp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Invalidate any existing OTPs for this registration
  await query(
    `DELETE FROM otp_verifications WHERE registration_id = $1`,
    [registrationId]
  );

  // Insert new OTP record
  await query(
    `INSERT INTO otp_verifications (registration_id, email, otp_hash, expires_at, attempts)
     VALUES ($1, $2, $3, $4, 0)`,
    [registrationId, email, hashedOtp, expiresAt]
  );

  return {
    otp: plainOtp,
    expiresAt,
  };
}

// Verify OTP
async function verifyOtpForRegistration(registrationId, plainOtp) {
  if (!plainOtp || plainOtp.length !== 6) {
    return { valid: false, error: 'OTP must be exactly 6 digits.' };
  }

  // Fetch the latest OTP record
  const otpRes = await query(
    `SELECT * FROM otp_verifications 
     WHERE registration_id = $1 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [registrationId]
  );

  if (otpRes.rows.length === 0) {
    return { valid: false, error: 'No OTP request found for this registration. Please request a new OTP.' };
  }

  const otpRecord = otpRes.rows[0];

  // Check if already verified
  if (otpRecord.verified_at) {
    return { valid: false, error: 'This OTP has already been used and verified.' };
  }

  // Check attempts
  if (otpRecord.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    return { valid: false, error: 'Too many invalid attempts. This OTP has been invalidated. Please request a new OTP.' };
  }

  // Check expiration
  const now = new Date();
  const expiresAt = new Date(otpRecord.expires_at);
  if (now > expiresAt) {
    return { valid: false, error: 'OTP has expired. Please request a new OTP.' };
  }

  // Increment attempt count
  await query(
    `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1`,
    [otpRecord.id]
  );

  // Compare bcrypt hash
  const isMatch = await bcrypt.compare(plainOtp, otpRecord.otp_hash);
  if (!isMatch) {
    const remaining = MAX_VERIFICATION_ATTEMPTS - (otpRecord.attempts + 1);
    return { 
      valid: false, 
      error: `Invalid OTP code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'OTP is now locked. Request a new OTP.'}` 
    };
  }

  // Mark as verified
  await query(
    `UPDATE otp_verifications 
     SET verified_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [otpRecord.id]
  );

  // Update registration status
  await query(
    `UPDATE registrations 
     SET email_verified = TRUE, status = 'OTP_VERIFIED', updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [registrationId]
  );

  return { valid: true };
}

module.exports = {
  generateOtp,
  hashOtp,
  createOtpForRegistration,
  verifyOtpForRegistration,
};
