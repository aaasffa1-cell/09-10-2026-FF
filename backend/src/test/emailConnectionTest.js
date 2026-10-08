require('dotenv').config();
const { verifyEmailConfiguration } = require('../services/emailService');

verifyEmailConfiguration()
  .then(() => {
    console.log('[EmailCheck] SMTP connection verified successfully.');
  })
  .catch((error) => {
    console.error('[EmailCheck] SMTP connection verification failed:', error.message);
    process.exitCode = 1;
  });
