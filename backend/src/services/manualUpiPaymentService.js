const { randomUUID } = require('crypto');
const { getClient, query } = require('../database/db');

const REGISTRATION_FEE = 40;
const CURRENCY = 'INR';
const UPI_PROVIDER = 'manual_upi';

class ManualPaymentError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.name = 'ManualPaymentError';
    this.code = code;
    this.status = status;
  }
}

function getUpiConfiguration() {
  const upiId = (process.env.UPI_ID || '').trim();
  const displayName = (process.env.UPI_DISPLAY_NAME || 'Free Fire Arena').trim();
  if (!/^[A-Za-z0-9._-]{2,100}@[A-Za-z0-9.-]{2,100}$/.test(upiId) ||
      !displayName || displayName.length > 80 || /[\u0000-\u001f\u007f]/.test(displayName) ||
      (process.env.REGISTRATION_FEE && Number(process.env.REGISTRATION_FEE) !== REGISTRATION_FEE) ||
      (process.env.CURRENCY && process.env.CURRENCY !== CURRENCY)) {
    throw new ManualPaymentError(
      'UPI payment details are not configured. Contact the tournament administrator.',
      'UPI_NOT_CONFIGURED',
      503
    );
  }
  return { upiId, displayName };
}

function createUpiUri(upiId, displayName, registrationId) {
  const parameters = new URLSearchParams({
    pa: upiId,
    pn: displayName,
    am: REGISTRATION_FEE.toFixed(2),
    cu: CURRENCY,
    tn: `Free Fire Arena registration ${registrationId}`,
  });
  return `upi://pay?${parameters.toString()}`;
}

function publicPayment(payment, registrationId, upi, reservationExpiresAt = null) {
  return {
    registrationId: `REG-${registrationId}`,
    amount: REGISTRATION_FEE,
    currency: CURRENCY,
    paymentMethod: 'UPI_QR',
    status: payment.status,
    upiId: upi.upiId,
    displayName: upi.displayName,
    upiUri: createUpiUri(upi.upiId, upi.displayName, registrationId),
    submittedAt: payment.submitted_at || null,
    rejectionReason: payment.status === 'REJECTED' ? payment.rejection_reason : null,
    reservationExpiresAt: reservationExpiresAt || null,
  };
}

async function appendPaymentEvent(client, paymentId, eventType, payload) {
  await client.query(
    `INSERT INTO payment_events
       (payment_id, provider, event_id, event_type, payload, signature_verified, processed, processed_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, FALSE, TRUE, CURRENT_TIMESTAMP)`,
    [
      paymentId,
      UPI_PROVIDER,
      `manual-upi:${paymentId}:${randomUUID()}`,
      eventType,
      JSON.stringify(payload),
    ]
  );
}

async function getLockedRegistration(client, registrationId) {
  const initial = await client.query(
    `SELECT tournament_id FROM registrations WHERE id = $1`,
    [registrationId]
  );
  if (!initial.rows.length) {
    throw new ManualPaymentError('Registration not found.', 'REGISTRATION_NOT_FOUND', 404);
  }

  await client.query(
    `SELECT id FROM tournaments WHERE id = $1 FOR UPDATE`,
    [initial.rows[0].tournament_id]
  );

  const registrationResult = await client.query(
    `SELECT id, tournament_id, status, email_verified, reservation_expires_at
     FROM registrations WHERE id = $1 FOR UPDATE`,
    [registrationId]
  );
  if (!registrationResult.rows.length) {
    throw new ManualPaymentError('Registration not found.', 'REGISTRATION_NOT_FOUND', 404);
  }
  const registration = registrationResult.rows[0];
  const tournamentResult = await client.query(
    `SELECT name AS tournament_name, entry_fee, squad_size, registration_open
     FROM tournaments WHERE id = $1`,
    [registration.tournament_id]
  );
  const playerCountResult = await client.query(
    `SELECT COUNT(*) AS player_count FROM players WHERE registration_id = $1`,
    [registrationId]
  );
  return {
    ...registration,
    ...tournamentResult.rows[0],
    player_count: playerCountResult.rows[0].player_count,
  };
}

async function createPaymentRequest(registrationId) {
  const upi = getUpiConfiguration();
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const existingCandidate = await client.query(
      `SELECT id FROM payments WHERE registration_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
      [registrationId]
    );
    let existing = { rows: [] };
    if (existingCandidate.rows.length) {
      existing = await client.query(
        `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
        [existingCandidate.rows[0].id]
      );
    }
    const registration = await getLockedRegistration(client, registrationId);
    if (!registration.email_verified) {
      throw new ManualPaymentError('Verify the captain email before starting payment.', 'EMAIL_NOT_VERIFIED');
    }
    if (Number(registration.entry_fee) !== REGISTRATION_FEE ||
        Number(registration.squad_size) !== 4 || Number(registration.player_count) !== 4) {
      throw new ManualPaymentError(
        'This registration must contain exactly four players and have the required ₹40 fee.',
        'INVALID_REGISTRATION',
        409
      );
    }

    if (!existing.rows.length) {
      existing = await client.query(
        `SELECT * FROM payments WHERE registration_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
        [registrationId]
      );
    }
    if (existing.rows.length) {
      const payment = existing.rows[0];
      if (payment.provider !== UPI_PROVIDER) {
        throw new ManualPaymentError(
          'This registration has a historical payment record and cannot start a new UPI payment.',
          'LEGACY_PAYMENT_RECORD',
          409
        );
      }
      if (['PENDING', 'REJECTED'].includes(payment.status) &&
          (!registration.reservation_expires_at ||
           new Date(registration.reservation_expires_at) <= new Date())) {
        throw new ManualPaymentError(
          'This registration reservation has expired. Please contact the tournament administrator.',
          'REGISTRATION_RESERVATION_EXPIRED',
          409
        );
      }
      await client.query('COMMIT');
      return publicPayment(payment, registrationId, upi, registration.reservation_expires_at);
    }
    if (registration.status === 'CONFIRMED') {
      throw new ManualPaymentError('This team is already confirmed.', 'ALREADY_REGISTERED', 409);
    }
    if (!registration.registration_open) {
      throw new ManualPaymentError('Tournament registration is closed.', 'REGISTRATION_CLOSED', 409);
    }
    if (!registration.reservation_expires_at ||
        new Date(registration.reservation_expires_at) <= new Date()) {
      throw new ManualPaymentError(
        'This registration reservation has expired. Please submit a new registration.',
        'REGISTRATION_RESERVATION_EXPIRED',
        409
      );
    }
    if (!['OTP_VERIFIED', 'PAYMENT_PENDING'].includes(registration.status)) {
      throw new ManualPaymentError('This registration is not eligible for payment.', 'REGISTRATION_NOT_ELIGIBLE', 409);
    }

    const orderId = `UPI-${randomUUID()}`;
    const inserted = await client.query(
      `INSERT INTO payments
         (registration_id, tournament_id, order_id, amount, currency, status, payment_method, provider)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', 'UPI_QR', $6)
       RETURNING *`,
      [registrationId, registration.tournament_id, orderId, REGISTRATION_FEE, CURRENCY, UPI_PROVIDER]
    );
    await client.query(
      `UPDATE registrations
       SET status = 'PAYMENT_PENDING', payment_status = 'PENDING',
           reservation_expires_at = CURRENT_TIMESTAMP + INTERVAL '15 minutes',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [registrationId]
    );
    await appendPaymentEvent(client, inserted.rows[0].id, 'PAYMENT_REQUEST_CREATED', {
      previousStatus: null,
      newStatus: 'PENDING',
      amount: REGISTRATION_FEE,
      currency: CURRENCY,
      paymentMethod: 'UPI_QR',
    });
    await client.query('COMMIT');
    return publicPayment(inserted.rows[0], registrationId, upi, registration.reservation_expires_at);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function getPaymentStatus(registrationId) {
  const upi = getUpiConfiguration();
  const result = await query(
    `SELECT r.id, r.status AS registration_status, r.reservation_expires_at,
            p.status, p.submitted_at, p.rejection_reason,
            p.provider
     FROM registrations r
     LEFT JOIN payments p ON p.registration_id = r.id
     WHERE r.id = $1
     ORDER BY p.created_at DESC NULLS LAST
     LIMIT 1`,
    [registrationId]
  );
  if (!result.rows.length) return null;
  const current = result.rows[0];
  if (!current.status) {
    return {
      registrationId: `REG-${registrationId}`,
      amount: REGISTRATION_FEE,
      currency: CURRENCY,
      paymentMethod: 'UPI_QR',
      status: 'PENDING',
      registrationStatus: current.registration_status,
      upiId: upi.upiId,
      displayName: upi.displayName,
      upiUri: createUpiUri(upi.upiId, upi.displayName, registrationId),
      submittedAt: null,
      rejectionReason: null,
      reservationExpiresAt: current.reservation_expires_at,
    };
  }
  if (current.provider !== UPI_PROVIDER) {
    throw new ManualPaymentError('Historical payment records are not part of the UPI review flow.', 'LEGACY_PAYMENT_RECORD', 409);
  }
  return {
    ...publicPayment(current, registrationId, upi, current.reservation_expires_at),
    registrationStatus: current.registration_status,
  };
}

async function submitUtr(registrationId, suppliedUtr) {
  if (typeof suppliedUtr !== 'string') {
    throw new ManualPaymentError('Enter the UTR / transaction reference number.', 'INVALID_UTR');
  }
  const utr = suppliedUtr.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{7,31}$/.test(utr)) {
    throw new ManualPaymentError('Enter a valid UTR / transaction reference (8–32 letters or numbers).', 'INVALID_UTR');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const paymentResult = await client.query(
      `SELECT * FROM payments WHERE registration_id = $1 AND provider = $2 LIMIT 1`,
      [registrationId, UPI_PROVIDER]
    );
    if (!paymentResult.rows.length) {
      throw new ManualPaymentError('Start the UPI payment before submitting a UTR.', 'PAYMENT_NOT_STARTED', 409);
    }
    const paymentResultLocked = await client.query(
      `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentResult.rows[0].id]
    );
    const payment = paymentResultLocked.rows[0];
    const registrationResult = await client.query(
      `SELECT id, status, email_verified, reservation_expires_at
       FROM registrations WHERE id = $1 FOR UPDATE`,
      [registrationId]
    );
    if (!registrationResult.rows.length) {
      throw new ManualPaymentError('Registration not found.', 'REGISTRATION_NOT_FOUND', 404);
    }
    const registration = registrationResult.rows[0];
    const playerCount = await client.query(
      `SELECT COUNT(*) AS player_count FROM players WHERE registration_id = $1`,
      [registrationId]
    );
    if (!registration.email_verified || Number(playerCount.rows[0].player_count) !== 4) {
      throw new ManualPaymentError('A verified email and exactly four registered players are required.', 'INVALID_REGISTRATION', 409);
    }
    if (payment.provider !== UPI_PROVIDER || Number(payment.amount) !== REGISTRATION_FEE ||
        payment.currency !== CURRENCY || payment.payment_method !== 'UPI_QR') {
      throw new ManualPaymentError('Payment does not match the required ₹40 UPI registration fee.', 'INVALID_PAYMENT', 409);
    }
    if (!['PENDING', 'REJECTED'].includes(payment.status)) {
      throw new ManualPaymentError('This payment cannot accept another UTR.', 'PAYMENT_NOT_SUBMITTABLE', 409);
    }
    if (payment.status === 'REJECTED' && payment.utr?.toUpperCase() === utr) {
      throw new ManualPaymentError('Submit a different UTR after a rejected payment.', 'UTR_ALREADY_REJECTED', 409);
    }
    if (registration.status === 'CONFIRMED') {
      throw new ManualPaymentError('This team is already confirmed.', 'ALREADY_REGISTERED', 409);
    }
    if (!['PAYMENT_PENDING'].includes(registration.status)) {
      throw new ManualPaymentError('This registration is not awaiting payment.', 'REGISTRATION_NOT_ELIGIBLE', 409);
    }
    if (!registration.reservation_expires_at ||
        new Date(registration.reservation_expires_at) <= new Date()) {
      throw new ManualPaymentError('This registration reservation has expired.', 'REGISTRATION_RESERVATION_EXPIRED', 409);
    }

    const duplicate = await client.query(
      `SELECT id FROM payments WHERE LOWER(utr) = LOWER($1) AND id <> $2 LIMIT 1`,
      [utr, payment.id]
    );
    if (duplicate.rows.length) {
      throw new ManualPaymentError('This UTR has already been submitted for another registration.', 'DUPLICATE_UTR', 409);
    }

    await client.query(
      `UPDATE payments
       SET utr = $1, status = 'UTR_SUBMITTED', submitted_at = CURRENT_TIMESTAMP,
           verified_at = NULL, verified_by = NULL, rejection_reason = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [utr, payment.id]
    );
    await client.query(
      `UPDATE registrations
       SET status = 'PAYMENT_PENDING', payment_status = 'UTR_SUBMITTED',
           reservation_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [registrationId]
    );
    await appendPaymentEvent(client, payment.id, 'UTR_SUBMITTED', {
      previousStatus: payment.status,
      newStatus: 'UTR_SUBMITTED',
      utr,
    });
    await client.query('COMMIT');
    return {
      registrationId: `REG-${registrationId}`,
      amount: REGISTRATION_FEE,
      currency: CURRENCY,
      paymentMethod: 'UPI_QR',
      status: 'UTR_SUBMITTED',
      submittedAt: new Date().toISOString(),
      rejectionReason: null,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505' && error.constraint === 'idx_payments_utr_unique') {
      throw new ManualPaymentError('This UTR has already been submitted for another registration.', 'DUPLICATE_UTR', 409);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function reviewPayment(paymentId, adminId, action, reason = '') {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const paymentResult = await client.query(
      `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId]
    );
    if (!paymentResult.rows.length) {
      throw new ManualPaymentError('Payment not found.', 'PAYMENT_NOT_FOUND', 404);
    }
    const payment = paymentResult.rows[0];
    const registrationInfo = await client.query(
      `SELECT tournament_id FROM registrations WHERE id = $1`,
      [payment.registration_id]
    );
    if (!registrationInfo.rows.length) {
      throw new ManualPaymentError('Registration not found.', 'REGISTRATION_NOT_FOUND', 404);
    }
    await client.query(
      `SELECT id FROM tournaments WHERE id = $1 FOR UPDATE`,
      [registrationInfo.rows[0].tournament_id]
    );
    const registrationResult = await client.query(
      `SELECT id, tournament_id, status
       FROM registrations WHERE id = $1 FOR UPDATE`,
      [payment.registration_id]
    );
    if (!registrationResult.rows.length) {
      throw new ManualPaymentError('Registration not found.', 'REGISTRATION_NOT_FOUND', 404);
    }
    const registration = registrationResult.rows[0];
    const playerCount = await client.query(
      `SELECT COUNT(*) AS player_count FROM players WHERE registration_id = $1`,
      [registration.id]
    );
    if (payment.provider !== UPI_PROVIDER || payment.status !== 'UTR_SUBMITTED' ||
        Number(payment.amount) !== REGISTRATION_FEE || payment.currency !== CURRENCY ||
        payment.payment_method !== 'UPI_QR' || !payment.utr) {
      throw new ManualPaymentError('Only a submitted ₹40 UPI payment can be reviewed.', 'PAYMENT_NOT_REVIEWABLE', 409);
    }
    if (Number(playerCount.rows[0].player_count) !== 4) {
      throw new ManualPaymentError('The registration does not contain exactly four players.', 'INVALID_REGISTRATION', 409);
    }

    let newStatus;
    let newRegistrationStatus;
    let newRegistrationPaymentStatus;
    let rejectionReason = null;
    if (action === 'verify') {
      const duplicate = await client.query(
        `SELECT id FROM payments WHERE LOWER(utr) = LOWER($1) AND id <> $2 LIMIT 1`,
        [payment.utr, payment.id]
      );
      if (duplicate.rows.length) {
        throw new ManualPaymentError('This UTR is already linked to another payment.', 'DUPLICATE_UTR', 409);
      }
      newStatus = 'VERIFIED';
      newRegistrationStatus = 'CONFIRMED';
      newRegistrationPaymentStatus = 'VERIFIED';
    } else if (action === 'reject') {
      rejectionReason = typeof reason === 'string' ? reason.trim() : '';
      if (rejectionReason.length < 3 || rejectionReason.length > 500) {
        throw new ManualPaymentError('Enter a rejection reason between 3 and 500 characters.', 'INVALID_REJECTION_REASON');
      }
      newStatus = 'REJECTED';
      newRegistrationStatus = 'PAYMENT_PENDING';
      newRegistrationPaymentStatus = 'REJECTED';
    } else {
      throw new ManualPaymentError('Invalid payment review action.', 'INVALID_REVIEW_ACTION');
    }

    await client.query(
      `UPDATE payments
       SET status = $1, verified_at = CURRENT_TIMESTAMP, verified_by = $2,
           paid_at = CASE WHEN $1 = 'VERIFIED' THEN CURRENT_TIMESTAMP ELSE NULL END,
           rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [newStatus, adminId, rejectionReason, payment.id]
    );
    await client.query(
      `UPDATE registrations
       SET status = $1, payment_status = $2,
           reservation_expires_at = CASE WHEN $2 = 'REJECTED'
             THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes' ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [newRegistrationStatus, newRegistrationPaymentStatus, registration.id]
    );
    await appendPaymentEvent(client, payment.id, `PAYMENT_${newStatus}`, {
      previousStatus: 'UTR_SUBMITTED',
      newStatus,
      adminId,
      rejectionReason,
    });
    await client.query('COMMIT');
    return { paymentId: payment.id, registrationId: registration.id, status: newStatus };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function getAdminPayments({ status, search, sort } = {}) {
  const params = [];
  const filters = [`p.provider = '${UPI_PROVIDER}'`];
  const allowedStatuses = new Set(['PENDING', 'UTR_SUBMITTED', 'VERIFIED', 'REJECTED']);
  if (status && allowedStatuses.has(status)) {
    params.push(status);
    filters.push(`p.status = $${params.length}`);
  }
  if (typeof search === 'string' && search.trim()) {
    params.push(`%${search.trim().slice(0, 100).toLowerCase()}%`);
    const position = params.length;
    filters.push(`(
      LOWER(r.captain_name) LIKE $${position}
      OR LOWER(p.utr) LIKE $${position}
      OR CAST(r.id AS TEXT) LIKE $${position}
    )`);
  }
  const direction = sort === 'oldest' ? 'ASC' : 'DESC';
  const result = await query(
    `SELECT p.id AS payment_id, p.registration_id, r.captain_name,
            t.name AS tournament_name, p.amount, p.currency, p.payment_method,
            p.utr, p.status, p.submitted_at, p.verified_at, p.rejection_reason,
            p.created_at, a.email AS reviewed_by_email
     FROM payments p
     JOIN registrations r ON r.id = p.registration_id
     JOIN tournaments t ON t.id = p.tournament_id
     LEFT JOIN admins a ON a.id = p.verified_by
     WHERE ${filters.join(' AND ')}
     ORDER BY COALESCE(p.submitted_at, p.created_at) ${direction}, p.id ${direction}
     LIMIT 200`,
    params
  );
  const summaryResult = await query(
    `SELECT COUNT(*) FILTER (WHERE status = 'UTR_SUBMITTED') AS pending,
            COUNT(*) FILTER (WHERE status = 'PENDING') AS awaiting_utr,
            COUNT(*) FILTER (WHERE status = 'VERIFIED') AS verified,
            COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected
     FROM payments WHERE provider = $1`,
    [UPI_PROVIDER]
  );
  return {
    payments: result.rows,
    counts: Object.fromEntries(
      Object.entries(summaryResult.rows[0] || {}).map(([key, value]) => [key, Number(value)])
    ),
  };
}

module.exports = {
  ManualPaymentError,
  createPaymentRequest,
  getPaymentStatus,
  submitUtr,
  reviewPayment,
  getAdminPayments,
  getUpiConfiguration,
};
