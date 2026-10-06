const crypto = require('crypto');
const Razorpay = require('razorpay');

let razorpayInstance = null;

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (keyId && keySecret && keyId.trim() !== '' && keySecret.trim() !== '') {
    if (!razorpayInstance) {
      razorpayInstance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
      console.log('[RazorpayService] Initialized with Key ID:', keyId);
    }
    return razorpayInstance;
  }
  return null;
}

// Create Razorpay Order (Amount in Paise: 40 INR = 4000 paise)
async function createOrder({ amountInRupees = 40, currency = 'INR', receipt, notes = {} }) {
  const rzp = getRazorpayInstance();
  const amountInPaise = Math.round(amountInRupees * 100);

  if (!rzp) {
    // If Razorpay is not configured in .env, generate a test order for development mode
    console.warn('[RazorpayService] RAZORPAY_KEY_ID / SECRET not configured. Generating sandbox test order.');
    const mockOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      id: mockOrderId,
      amount: amountInPaise,
      currency,
      receipt,
      isTestMode: true,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    };
  }

  try {
    const order = await rzp.orders.create({
      amount: amountInPaise,
      currency,
      receipt: String(receipt || `rcpt_${Date.now()}`),
      notes,
    });
    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      isTestMode: false,
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  } catch (err) {
    console.error('[RazorpayService] Order Creation Failed:', err);
    throw new Error(`Razorpay order creation failed: ${err.message || err.error?.description || 'Gateway error'}`);
  }
}

// Verify Payment Signature
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret || keySecret.trim() === '') {
    // In dev sandbox when secret is not configured, if signature equals test hash or test flow
    if (orderId && orderId.startsWith('order_test_')) {
      console.log('[RazorpayService] Dev sandbox payment verified for test order:', orderId);
      return true;
    }
    console.warn('[RazorpayService] Warning: RAZORPAY_KEY_SECRET not set. Cannot verify production signature.');
    return false;
  }

  const generatedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return generatedSignature === signature;
}

// Verify Webhook Signature
function verifyWebhookSignature(rawBody, signature) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  return expectedSignature === signature;
}

module.exports = {
  getRazorpayInstance,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
};
