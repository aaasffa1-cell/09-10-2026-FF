const express = require('express');
const router = express.Router();
const { 
  createPaymentOrder, 
  verifyPayment, 
  handleWebhook 
} = require('../controllers/paymentController');

// Step 3: Create Server-controlled Razorpay order
router.post('/create-order', createPaymentOrder);

// Step 4: Verify server-side Razorpay signature and confirm registration
router.post('/verify', verifyPayment);

// Webhook for asynchronous payment verification
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
