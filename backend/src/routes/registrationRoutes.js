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

// Step 1: Submit squad details and generate OTP
router.post('/', validateRegistrationInput, createRegistration);

// Step 1b: Resend OTP
router.post('/:id/send-otp', otpRequestLimiter, sendOtp);

// Step 2: Verify 6-digit OTP
router.post('/:id/verify-otp', otpVerifyLimiter, verifyOtp);

// Status check / details
router.get('/:id/status', getRegistrationStatus);

module.exports = router;
