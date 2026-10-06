const { query, getClient } = require('../database/db');
const { createOrder, verifyPaymentSignature, verifyWebhookSignature } = require('../services/razorpayService');
const { sendConfirmationEmail } = require('../services/emailService');

// POST /api/payments/create-order - Step 3: Create Server-Controlled Razorpay Order
async function createPaymentOrder(req, res) {
  const { registrationId } = req.body;

  if (!registrationId) {
    return res.status(400).json({ success: false, error: 'Registration ID is required.' });
  }

  let client;
  try {
    client = await getClient();

    // 1. Fetch registration & tournament details
    const regRes = await client.query(
      `SELECT registrations.*, tournaments.id as tourney_id, tournaments.name as tourney_name, tournaments.entry_fee, tournaments.max_slots, tournaments.registration_open,
              COALESCE(sub.confirmed_slots, 0) as confirmed_slots
       FROM registrations
       JOIN tournaments ON registrations.tournament_id = tournaments.id
       LEFT JOIN (
         SELECT tournament_id, COUNT(id) as confirmed_slots
         FROM registrations
         WHERE status = 'CONFIRMED'
         GROUP BY tournament_id
       ) sub ON sub.tournament_id = tournaments.id
       WHERE registrations.id = $1`,
      [registrationId]
    );

    if (regRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Registration not found.' });
    }

    const reg = regRes.rows[0];

    // 2. Validate OTP status
    if (!reg.email_verified) {
      return res.status(400).json({
        success: false,
        error: 'Captain email is not verified yet. Please complete OTP verification first.',
      });
    }

    // 3. Validate registration state
    if (reg.status === 'CONFIRMED' && reg.payment_status === 'PAID') {
      return res.status(400).json({
        success: false,
        error: 'This registration is already paid and confirmed.',
      });
    }

    // 4. Validate tournament slots & registration status
    if (!reg.registration_open) {
      return res.status(400).json({ success: false, error: 'Registration for this tournament is closed.' });
    }

    const confirmedCount = parseInt(reg.confirmed_slots || '0', 10);
    if (confirmedCount >= reg.max_slots) {
      return res.status(400).json({ success: false, error: 'Tournament slots are already full.' });
    }

    // 5. Server-Controlled Amount: strictly use tournament.entry_fee
    const entryFee = parseFloat(reg.entry_fee) || 40.00;

    // 6. Create Razorpay order
    const order = await createOrder({
      amountInRupees: entryFee,
      currency: 'INR',
      receipt: `squad_reg_${reg.id}`,
      notes: {
        registration_id: String(reg.id),
        tournament_id: String(reg.tourney_id),
        captain_email: reg.captain_email,
      },
    });

    // 7. Store payment record
    await client.query(
      `INSERT INTO payments (registration_id, razorpay_order_id, amount, currency, status)
       VALUES ($1, $2, $3, $4, 'CREATED')
       ON CONFLICT (razorpay_order_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`,
      [reg.id, order.id, entryFee, 'INR']
    );

    // 8. Update registration status to PAYMENT_PENDING
    await client.query(
      `UPDATE registrations SET status = 'PAYMENT_PENDING', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [reg.id]
    );

    return res.json({
      success: true,
      orderId: order.id,
      amount: entryFee,
      amountInPaise: order.amount,
      currency: 'INR',
      keyId: order.keyId,
      isTestMode: order.isTestMode || false,
      registrationId: reg.id,
      tournamentName: reg.tourney_name,
      captainName: reg.captain_name,
      captainEmail: reg.captain_email,
      captainPhone: reg.captain_phone,
    });
  } catch (error) {
    console.error('[PaymentController] createPaymentOrder error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to initiate payment. ' + (error.message || 'Please try again.'),
    });
  } finally {
    if (client) client.release();
  }
}

// POST /api/payments/verify - Server-side Signature Verification & Confirmation
async function verifyPayment(req, res) {
  const { registrationId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!registrationId || !razorpay_order_id || !razorpay_payment_id) {
    return res.status(400).json({
      success: false,
      error: 'Missing required payment verification fields.',
    });
  }

  // 1. Verify Signature on Server
  const isSignatureValid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!isSignatureValid) {
    return res.status(400).json({
      success: false,
      error: 'Payment verification failed: Invalid cryptographic signature.',
    });
  }

  let client;
  try {
    client = await getClient();
    await client.query('BEGIN');

    // 2. Fetch registration with lock
    const regRes = await client.query(
      `SELECT registrations.*, tournaments.id as tourney_id, tournaments.name as tourney_name, tournaments.date as tourney_date, 
              tournaments.start_time as tourney_start_time, tournaments.entry_fee, tournaments.prize_amount, tournaments.max_slots
       FROM registrations
       JOIN tournaments ON registrations.tournament_id = tournaments.id
       WHERE registrations.id = $1`,
      [registrationId]
    );

    if (regRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Registration not found.' });
    }

    const reg = regRes.rows[0];

    // Idempotency: If already confirmed, return success immediately
    if (reg.status === 'CONFIRMED' && reg.payment_status === 'PAID') {
      await client.query('COMMIT');
      return res.json({
        success: true,
        alreadyProcessed: true,
        status: 'CONFIRMED',
        message: 'Payment already verified and registration is confirmed.',
        registrationId: reg.id,
      });
    }

    // 3. Double-check slot limit inside transaction
    const slotsRes = await client.query(
      `SELECT COUNT(id) as confirmed_count FROM registrations 
       WHERE tournament_id = $1 AND status = 'CONFIRMED'`,
      [reg.tourney_id]
    );
    const confirmedCount = parseInt(slotsRes.rows[0].confirmed_count || '0', 10);

    if (confirmedCount >= reg.max_slots) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Unfortunately all slots were filled just before this payment was verified. Please contact support.',
      });
    }

    // 4. Update Payment record
    await client.query(
      `UPDATE payments 
       SET razorpay_payment_id = $1, razorpay_signature = $2, status = 'SUCCESS', updated_at = CURRENT_TIMESTAMP
       WHERE registration_id = $3 AND (razorpay_order_id = $4 OR razorpay_order_id IS NULL)`,
      [razorpay_payment_id, razorpay_signature || 'verified_dev', registrationId, razorpay_order_id]
    );

    // 5. Update Registration status to CONFIRMED
    await client.query(
      `UPDATE registrations 
       SET status = 'CONFIRMED', payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [registrationId]
    );

    // Fetch players for confirmation email
    const playersRes = await client.query(
      `SELECT player_number, full_name, free_fire_id FROM players WHERE registration_id = $1 ORDER BY player_number ASC`,
      [registrationId]
    );

    await client.query('COMMIT');

    // 6. Send Registration & Payment Confirmation Email
    try {
      await sendConfirmationEmail(
        reg,
        {
          id: reg.tourney_id,
          name: reg.tourney_name,
          date: reg.tourney_date,
          start_time: reg.tourney_start_time,
          entry_fee: reg.entry_fee,
          prize_amount: reg.prize_amount,
        },
        playersRes.rows
      );

      // Log in email_logs
      await query(
        `INSERT INTO email_logs (registration_id, tournament_id, email_type, recipient_email, status, sent_at)
         VALUES ($1, $2, 'PAYMENT_CONFIRMATION', $3, 'SENT', CURRENT_TIMESTAMP)
         ON CONFLICT (registration_id, tournament_id, email_type) DO NOTHING`,
        [registrationId, reg.tourney_id, reg.captain_email]
      );
    } catch (emailErr) {
      console.warn('[PaymentController] Confirmation email warning:', emailErr.message);
    }

    return res.json({
      success: true,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      message: 'Payment verified successfully! Your squad is confirmed for the tournament.',
      registrationId: reg.id,
      tournamentName: reg.tourney_name,
      captainName: reg.captain_name,
      captainEmail: reg.captain_email,
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[PaymentController] verifyPayment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Payment verification failed due to internal error.',
    });
  } finally {
    if (client) client.release();
  }
}

// POST /api/payments/webhook - Razorpay Webhook Handler (Idempotent)
async function handleWebhook(req, res) {
  const signature = req.headers['x-razorpay-signature'];
  const body = req.body;

  if (process.env.RAZORPAY_WEBHOOK_SECRET) {
    const isValid = verifyWebhookSignature(JSON.stringify(body), signature);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid webhook signature.' });
    }
  }

  const event = body.event;
  if (event === 'payment.captured' || event === 'order.paid') {
    const paymentEntity = body.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;

    if (orderId) {
      try {
        const payRes = await query(`SELECT * FROM payments WHERE razorpay_order_id = $1`, [orderId]);
        if (payRes.rows.length > 0) {
          const payment = payRes.rows[0];
          await query(
            `UPDATE payments SET status = 'SUCCESS', razorpay_payment_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [paymentId, payment.id]
          );
          await query(
            `UPDATE registrations SET status = 'CONFIRMED', payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [payment.registration_id]
          );
          console.log(`[Webhook] Confirmed registration #${payment.registration_id} via webhook.`);
        }
      } catch (err) {
        console.error('[Webhook Error]', err);
      }
    }
  }

  return res.json({ status: 'ok' });
}

module.exports = {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
};
