const express = require('express');
const router = express.Router();
const { 
  createRegistration, 
  sendOtp, 
  verifyOtp, 
  getRegistrationStatus 
} = require('../controllers/registrationController');
const { validateRegistrationInput } = require('../middleware/validateMiddleware');
const { otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');
const { requireRegistrationAccess } = require('../middleware/registrationAccessMiddleware');
const { requireUserAuth } = require('../middleware/userAuthMiddleware');

// Step 1: Submit squad details and generate OTP
router.post('/', requireUserAuth, otpRequestLimiter, validateRegistrationInput, createRegistration);

// Step 1b: Resend OTP
router.post('/:id/send-otp', otpRequestLimiter, requireRegistrationAccess, sendOtp);

// Step 2: Verify 6-digit OTP
router.post('/:id/verify-otp', otpVerifyLimiter, requireRegistrationAccess, verifyOtp);

// Status check / details
router.get('/:id/status', requireRegistrationAccess, getRegistrationStatus);

module.exports = router;
