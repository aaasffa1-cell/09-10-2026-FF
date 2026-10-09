const express = require('express');
const router = express.Router();
const {
  requestLoginOtp,
  verifyLoginOtp,
  getUserProfile,
  logoutUser,
  getUserDashboard,
} = require('../controllers/userAuthController');
const { requireUserAuth } = require('../middleware/userAuthMiddleware');
const { otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');

router.post('/request-otp', otpRequestLimiter, requestLoginOtp);
router.post('/verify-otp', otpVerifyLimiter, verifyLoginOtp);
router.get('/me', requireUserAuth, getUserProfile);
router.post('/logout', logoutUser);
router.get('/dashboard', requireUserAuth, getUserDashboard);

module.exports = router;
