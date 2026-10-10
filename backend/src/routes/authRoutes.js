const express = require('express');
const router = express.Router();
const {
  requestLoginOtp,
  verifyLoginOtp,
  getUserProfile,
  logoutUser,
  getUserDashboard,
  getOwnedPaymentStatus,
  submitOwnedUtr,
} = require('../controllers/userAuthController');
const { requireUserAuth } = require('../middleware/userAuthMiddleware');
const {
  otpRequestLimiter,
  otpVerifyLimiter,
  paymentStatusLimiter,
  paymentUtrLimiter,
} = require('../middleware/rateLimiter');

router.post('/request-otp', otpRequestLimiter, requestLoginOtp);
router.post('/verify-otp', otpVerifyLimiter, verifyLoginOtp);
router.get('/me', requireUserAuth, getUserProfile);
router.post('/logout', logoutUser);
router.get('/dashboard', requireUserAuth, getUserDashboard);
router.get('/dashboard/registrations/:registrationId/payment', requireUserAuth, paymentStatusLimiter, getOwnedPaymentStatus);
router.post('/dashboard/registrations/:registrationId/utr', requireUserAuth, paymentUtrLimiter, submitOwnedUtr);

module.exports = router;
