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
        r.created_at,
        r.updated_at,
        t.name as tournament_name,
        t.date as tournament_date,
        t.start_time as tournament_start_time,
        t.entry_fee,
        p.razorpay_order_id,
        p.razorpay_payment_id
      FROM registrations r
      JOIN tournaments t ON r.tournament_id = t.id
      LEFT JOIN payments p ON r.id = p.registration_id AND p.status = 'SUCCESS'
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
    }

    const registrations = regRes.rows.map(r => ({
      ...r,
      players: playersMap[r.id] || [],
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
    
    // Revenue collected
    const revenueRes = await query(`
      SELECT COALESCE(SUM(t.entry_fee), 0) as total_revenue
      FROM registrations r
      JOIN tournaments t ON r.tournament_id = t.id
      WHERE r.status = 'CONFIRMED'
    `);

    // Email logs count
    const emailLogsRes = await query(`SELECT COUNT(id) as count FROM email_logs WHERE status = 'SENT'`);

    return res.json({
      success: true,
      stats: {
        totalTournaments: parseInt(totalTournamentsRes.rows[0].count || '0', 10),
        upcomingTournaments: parseInt(upcomingTournamentsRes.rows[0].count || '0', 10),
        totalConfirmedSquads: parseInt(totalConfirmedRes.rows[0].count || '0', 10),
        pendingRegistrations: parseInt(pendingRegistrationsRes.rows[0].count || '0', 10),
        totalRevenue: parseFloat(revenueRes.rows[0].total_revenue || '0'),
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

module.exports = {
  getRegistrations,
  getDashboardStats,
};
