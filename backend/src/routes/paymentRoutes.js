const express = require('express');
const router = express.Router();
const {
  startPayment,
  submitUtr,
  getPaymentStatus,
} = require('../controllers/paymentController');
const { requireRegistrationAccess } = require('../middleware/registrationAccessMiddleware');
const {
  paymentOrderLimiter,
  paymentStatusLimiter,
  paymentUtrLimiter,
} = require('../middleware/rateLimiter');

router.post('/registrations/:id/start', paymentOrderLimiter, requireRegistrationAccess, startPayment);
router.post('/registrations/:id/utr', paymentUtrLimiter, requireRegistrationAccess, submitUtr);
router.get('/registrations/:id/status', paymentStatusLimiter, requireRegistrationAccess, getPaymentStatus);

module.exports = router;
