async function migrateEmailOtpRateLimits(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS email_otp_rate_limits (
      email VARCHAR(255) PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = { migrateEmailOtpRateLimits };
