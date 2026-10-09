const { query } = require('../database/db');
const {
  ManualPaymentError,
  createPaymentRequest,
  getPaymentStatus: fetchPaymentStatus,
  submitUtr: submitPaymentUtr,
  reviewPayment,
  getAdminPayments,
} = require('../services/manualUpiPaymentService');
const { sendConfirmationEmail } = require('../services/emailService');

async function sendPaymentConfirmation(registrationId) {
  try {
    const registrationResult = await query(
      `SELECT r.*, t.name AS tournament_name, t.date AS tournament_date,
              t.start_time AS tournament_start_time, t.entry_fee, t.prize_amount
       FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       WHERE r.id = $1`,
      [registrationId]
    );
    if (!registrationResult.rows.length) return;
    const registration = registrationResult.rows[0];
    const playersResult = await query(
      `SELECT player_number, full_name, free_fire_id
       FROM players WHERE registration_id = $1 ORDER BY player_number`,
      [registrationId]
    );

    const emailResult = await sendConfirmationEmail(
      registration,
      {
        id: registration.tournament_id,
        name: registration.tournament_name,
        date: registration.tournament_date,
        start_time: registration.tournament_start_time,
        entry_fee: registration.entry_fee,
        prize_amount: registration.prize_amount,
      },
      playersResult.rows
    );
    await query(
      `INSERT INTO email_logs
         (registration_id, tournament_id, email_type, recipient_email, status, provider_message_id, sent_at)
       VALUES ($1, $2, 'PAYMENT_CONFIRMATION', $3, 'SENT', $4, CURRENT_TIMESTAMP)
       ON CONFLICT (registration_id, tournament_id, email_type)
       DO UPDATE SET status = 'SENT', provider_message_id = EXCLUDED.provider_message_id,
                     sent_at = CURRENT_TIMESTAMP, last_error = NULL`,
      [registrationId, registration.tournament_id, registration.captain_email, emailResult.messageId || null]
    );
  } catch (error) {
    console.error('[PaymentController] Payment confirmation email failed:', error.message);
    try {
      const registrationResult = await query(
        `SELECT tournament_id, captain_email FROM registrations WHERE id = $1`,
        [registrationId]
      );
      if (registrationResult.rows.length) {
        const registration = registrationResult.rows[0];
        await query(
          `INSERT INTO email_logs
             (registration_id, tournament_id, email_type, recipient_email, status, last_error)
           VALUES ($1, $2, 'PAYMENT_CONFIRMATION', $3, 'FAILED', $4)
           ON CONFLICT (registration_id, tournament_id, email_type)
           DO UPDATE SET status = 'FAILED', last_error = EXCLUDED.last_error`,
          [registrationId, registration.tournament_id, registration.captain_email, error.message]
        );
      }
    } catch (logError) {
      console.error('[PaymentController] Failed to record payment email status:', logError.message);
    }
  }
}

function paymentErrorResponse(res, error) {
  if (!(error instanceof ManualPaymentError)) {
    console.error('[PaymentController] Payment operation failed:', error);
    return res.status(500).json({ success: false, error: 'Payment operation failed.' });
  }
  return res.status(error.status).json({
    success: false,
    error: error.message,
    code: error.code,
  });
}

async function startPayment(req, res) {
  try {
    const payment = await createPaymentRequest(req.registration.id);
    return res.status(200).json({ success: true, payment });
  } catch (error) {
    return paymentErrorResponse(res, error);
  }
}

async function submitUtr(req, res) {
  try {
    const payment = await submitPaymentUtr(req.registration.id, req.body && req.body.utr);
    return res.status(200).json({
      success: true,
      message: 'Payment submitted for admin verification.',
      payment,
    });
  } catch (error) {
    return paymentErrorResponse(res, error);
  }
}

async function getPaymentStatus(req, res) {
  try {
    const payment = await fetchPaymentStatus(req.registration.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Registration not found.' });
    }
    return res.json({ success: true, payment });
  } catch (error) {
    return paymentErrorResponse(res, error);
  }
}

async function getPaymentsForAdmin(req, res) {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const sort = req.query.sort === 'oldest' ? 'oldest' : 'newest';
  try {
    const result = await getAdminPayments({ status, search, sort });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[PaymentController] Admin payment list failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch payment review queue.' });
  }
}

async function verifyPayment(req, res) {
  const paymentId = Number(req.params.paymentId);
  if (!Number.isSafeInteger(paymentId) || paymentId < 1) {
    return res.status(400).json({ success: false, error: 'A valid payment ID is required.' });
  }
  if (req.body?.confirmPaymentReceived !== true) {
    return res.status(400).json({
      success: false,
      error: 'Confirm that the actual payment is visible in the receiving account before approving.',
      code: 'PAYMENT_RECEIPT_CONFIRMATION_REQUIRED',
    });
  }
  try {
    const result = await reviewPayment(paymentId, req.admin.id, 'verify', '', true);
    await sendPaymentConfirmation(result.registrationId);
    return res.json({
      success: true,
      message: 'Payment verified and team registration confirmed.',
      payment: { registrationId: `REG-${result.registrationId}`, status: result.status },
    });
  } catch (error) {
    return paymentErrorResponse(res, error);
  }
}

async function rejectPayment(req, res) {
  const paymentId = Number(req.params.paymentId);
  if (!Number.isSafeInteger(paymentId) || paymentId < 1) {
    return res.status(400).json({ success: false, error: 'A valid payment ID is required.' });
  }
  try {
    const result = await reviewPayment(paymentId, req.admin.id, 'reject', req.body && req.body.reason);
    return res.json({
      success: true,
      message: 'Payment rejected. The player can submit a corrected UTR.',
      payment: { registrationId: `REG-${result.registrationId}`, status: result.status },
    });
  } catch (error) {
    return paymentErrorResponse(res, error);
  }
}

module.exports = {
  startPayment,
  submitUtr,
  getPaymentStatus,
  getPaymentsForAdmin,
  verifyPayment,
  rejectPayment,
};
