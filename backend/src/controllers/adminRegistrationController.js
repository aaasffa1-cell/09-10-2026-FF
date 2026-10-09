const { query } = require('../database/db');

// GET /api/admin/registrations - Search and filter squad registrations
async function getRegistrations(req, res) {
  const { tournamentId, status, paymentStatus, search } = req.query;

  try {
    let sql = `
      SELECT 
        r.id,
        r.tournament_id,
        r.captain_name,
        r.captain_email,
        r.captain_phone,
        r.status,
        r.email_verified,
        r.payment_status,
        r.squad_number,
        r.created_at,
        r.updated_at,
        t.name as tournament_name,
        t.date as tournament_date,
        t.start_time as tournament_start_time,
        t.entry_fee
      FROM registrations r
      JOIN tournaments t ON r.tournament_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (tournamentId && !isNaN(parseInt(tournamentId, 10))) {
      params.push(parseInt(tournamentId, 10));
      sql += ` AND r.tournament_id = $${params.length}`;
    }

    if (status && status.trim() !== '') {
      params.push(status.trim());
      sql += ` AND r.status = $${params.length}`;
    }

    if (paymentStatus && paymentStatus.trim() !== '') {
      params.push(paymentStatus.trim());
      sql += ` AND r.payment_status = $${params.length}`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (
        LOWER(r.captain_name) LIKE $${params.length} OR
        LOWER(r.captain_email) LIKE $${params.length} OR
        LOWER(r.captain_phone) LIKE $${params.length} OR
        CAST(r.id AS TEXT) LIKE $${params.length}
      )`;
    }

    sql += ` ORDER BY r.created_at DESC LIMIT 200`;

    const regRes = await query(sql, params);

    // Fetch all players for these registrations
    const regIds = regRes.rows.map(r => r.id);
    let playersMap = {};
    let paymentsMap = {};

    if (regIds.length > 0) {
      const playersRes = await query(
        `SELECT registration_id, player_number, full_name, free_fire_id
         FROM players
         WHERE registration_id = ANY($1::int[])
         ORDER BY registration_id, player_number ASC`,
        [regIds]
      );

      playersRes.rows.forEach(p => {
        if (!playersMap[p.registration_id]) {
          playersMap[p.registration_id] = [];
        }
        playersMap[p.registration_id].push(p);
      });

      const paymentsRes = await query(
        `SELECT id AS payment_id, registration_id, order_id, provider_order_id, provider_transaction_id,
                amount AS payment_amount, currency AS payment_currency, status AS payment_status_detail,
                payment_method, utr, submitted_at, verified_at, verified_by,
                rejection_reason, paid_at, created_at AS payment_created_at
         FROM payments
         WHERE registration_id = ANY($1::int[])
         ORDER BY registration_id, created_at DESC, id DESC`,
        [regIds]
      );
      paymentsRes.rows.forEach(payment => {
        if (!paymentsMap[payment.registration_id]) {
          paymentsMap[payment.registration_id] = [];
        }
        paymentsMap[payment.registration_id].push(payment);
      });
    }

    const registrations = regRes.rows.map(r => ({
      ...r,
      players: playersMap[r.id] || [],
      payment_attempts: paymentsMap[r.id] || [],
    }));

    return res.json({
      success: true,
      count: registrations.length,
      registrations,
    });
  } catch (error) {
    console.error('[AdminRegistrationController] getRegistrations error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch registrations.',
    });
  }
}

// GET /api/admin/stats - Simple useful dashboard stats
async function getDashboardStats(req, res) {
  try {
    const totalTournamentsRes = await query(`SELECT COUNT(id) as count FROM tournaments`);
    const upcomingTournamentsRes = await query(`SELECT COUNT(id) as count FROM tournaments WHERE date >= CURRENT_DATE AND registration_open = TRUE`);
    const totalConfirmedRes = await query(`SELECT COUNT(id) as count FROM registrations WHERE status = 'CONFIRMED'`);
    const pendingRegistrationsRes = await query(`SELECT COUNT(id) as count FROM registrations WHERE status IN ('PENDING', 'OTP_VERIFIED', 'PAYMENT_PENDING')`);
    
    const totalTeamsRes = await query(`SELECT COUNT(id) AS count FROM registrations`);
    const paidTeamsRes = await query(
      `SELECT COUNT(id) AS count FROM registrations
       WHERE status = 'CONFIRMED' AND payment_status IN ('PAID', 'VERIFIED')`
    );
    const pendingPaymentsRes = await query(
      `SELECT COUNT(id) AS count FROM payments WHERE status IN ('PENDING', 'PROCESSING', 'UTR_SUBMITTED')`
    );
    const failedPaymentsRes = await query(
      `SELECT COUNT(id) AS count FROM payments WHERE status IN ('FAILED', 'CANCELLED', 'REJECTED')`
    );

    // Revenue is based only on verified successful payment records.
    const revenueRes = await query(`
      SELECT COALESCE(SUM(amount), 0) as total_revenue
      FROM payments
      WHERE status IN ('SUCCESS', 'VERIFIED')
    `);

    // Email logs count
    const emailLogsRes = await query(`SELECT COUNT(id) as count FROM email_logs WHERE status = 'SENT'`);

    return res.json({
      success: true,
      stats: {
        totalTournaments: parseInt(totalTournamentsRes.rows[0].count || '0', 10),
        upcomingTournaments: parseInt(upcomingTournamentsRes.rows[0].count || '0', 10),
        totalConfirmedSquads: parseInt(totalConfirmedRes.rows[0].count || '0', 10),
        totalTeams: parseInt(totalTeamsRes.rows[0].count || '0', 10),
        paidTeams: parseInt(paidTeamsRes.rows[0].count || '0', 10),
        pendingPayments: parseInt(pendingPaymentsRes.rows[0].count || '0', 10),
        failedPayments: parseInt(failedPaymentsRes.rows[0].count || '0', 10),
        pendingRegistrations: parseInt(pendingRegistrationsRes.rows[0].count || '0', 10),
        totalRevenue: parseFloat(revenueRes.rows[0].total_revenue || '0'),
        totalCollected: parseFloat(revenueRes.rows[0].total_revenue || '0'),
        roomEmailsSent: parseInt(emailLogsRes.rows[0].count || '0', 10),
      },
    });
  } catch (error) {
    console.error('[AdminRegistrationController] getDashboardStats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats.',
    });
  }
}

async function getPaymentEvents(req, res) {
  const paymentId = Number(req.params.paymentId);
  if (!Number.isSafeInteger(paymentId) || paymentId < 1) {
    return res.status(400).json({ success: false, error: 'A valid payment ID is required.' });
  }

  try {
    const result = await query(
      `SELECT id, event_id, event_type,
              CASE WHEN event_type = 'LEGACY_PAYMENT_VERIFICATION' THEN '{}'::jsonb ELSE payload END AS payload,
              signature_verified, processed, created_at
       FROM payment_events
       WHERE payment_id = $1
       ORDER BY created_at DESC, id DESC`,
      [paymentId]
    );
    return res.json({ success: true, events: result.rows });
  } catch (error) {
    console.error('[AdminRegistrationController] getPaymentEvents error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch payment event history.' });
  }
}

module.exports = {
  getRegistrations,
  getDashboardStats,
  getPaymentEvents,
};
