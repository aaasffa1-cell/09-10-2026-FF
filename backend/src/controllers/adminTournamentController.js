const { query } = require('../database/db');

// GET /api/admin/tournaments - Full list with stats
async function getAdminTournaments(req, res) {
  try {
    const result = await query(`
      SELECT 
        tournaments.id,
        tournaments.name,
        tournaments.description,
        tournaments.date,
        tournaments.start_time,
        tournaments.entry_fee,
        tournaments.prize_amount,
        tournaments.squad_size,
        tournaments.max_slots,
        tournaments.rules,
        tournaments.registration_open,
        tournaments.created_at,
        tournaments.updated_at,
        COALESCE(confirmed_sub.confirmed_slots, 0) AS confirmed_slots,
        COALESCE(total_sub.total_registrations, 0) AS total_registrations,
        room_credentials.room_id,
        room_credentials.room_password
      FROM tournaments
      LEFT JOIN (
        SELECT tournament_id, COUNT(id) AS confirmed_slots
        FROM registrations
        WHERE status = 'CONFIRMED'
        GROUP BY tournament_id
      ) confirmed_sub ON confirmed_sub.tournament_id = tournaments.id
      LEFT JOIN (
        SELECT tournament_id, COUNT(id) AS total_registrations
        FROM registrations
        GROUP BY tournament_id
      ) total_sub ON total_sub.tournament_id = tournaments.id
      LEFT JOIN room_credentials ON room_credentials.tournament_id = tournaments.id
      ORDER BY tournaments.date DESC, tournaments.start_time DESC
    `);

    const tournaments = result.rows.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      date: t.date,
      startTime: t.start_time,
      entryFee: parseFloat(t.entry_fee),
      prizeAmount: parseFloat(t.prize_amount),
      squadSize: t.squad_size,
      maxSlots: t.max_slots,
      confirmedSlots: parseInt(t.confirmed_slots || '0', 10),
      totalRegistrations: parseInt(t.total_registrations || '0', 10),
      availableSlots: Math.max(0, t.max_slots - parseInt(t.confirmed_slots || '0', 10)),
      rules: t.rules,
      registrationOpen: t.registration_open,
      hasRoomCredentials: Boolean(t.room_id && t.room_password),
      roomId: t.room_id || null,
      roomPassword: t.room_password || null,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    return res.json({
      success: true,
      tournaments,
    });
  } catch (error) {
    console.error('[AdminTournamentController] getAdminTournaments error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch tournaments.' });
  }
}

// POST /api/admin/tournaments - Create tournament
async function createTournament(req, res) {
  const {
    name,
    description,
    date,
    startTime,
    prizeAmount = 300.00,
    squadSize = 4,
    maxSlots = 25,
    rules,
    registrationOpen = true,
  } = req.body;

  try {
    const result = await query(
      `INSERT INTO tournaments (name, description, date, start_time, entry_fee, prize_amount, squad_size, max_slots, rules, registration_open)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        name.trim(),
        description ? description.trim() : '',
        date,
        startTime.trim(),
        40.00,
        parseFloat(prizeAmount) || 300.00,
        parseInt(squadSize, 10) || 4,
        parseInt(maxSlots, 10) || 25,
        rules ? rules.trim() : '',
        registrationOpen === true || registrationOpen === 'true',
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Tournament created successfully.',
      tournament: result.rows[0],
    });
  } catch (error) {
    console.error('[AdminTournamentController] createTournament error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create tournament. ' + error.message,
    });
  }
}

// PUT /api/admin/tournaments/:id - Edit tournament
async function updateTournament(req, res) {
  const { id } = req.params;
  const {
    name,
    description,
    date,
    startTime,
    entryFee,
    prizeAmount,
    squadSize,
    maxSlots,
    rules,
    registrationOpen,
  } = req.body;

  if (entryFee !== undefined && Number(entryFee) !== 40) {
    return res.status(400).json({ success: false, error: 'The team registration fee is fixed at ₹40.' });
  }

  try {
    // 1. Check existing tournament and confirmed squad count
    const existingRes = await query(
      `SELECT tournaments.*, COALESCE(sub.confirmed_slots, 0) as confirmed_slots
       FROM tournaments
       LEFT JOIN (
         SELECT tournament_id, COUNT(id) as confirmed_slots
         FROM registrations
         WHERE status = 'CONFIRMED'
         GROUP BY tournament_id
       ) sub ON sub.tournament_id = tournaments.id
       WHERE tournaments.id = $1`,
      [id]
    );

    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found.' });
    }

    const current = existingRes.rows[0];
    const confirmedCount = parseInt(current.confirmed_slots || '0', 10);

    // Rule: Maximum slots cannot be less than already confirmed squads
    if (maxSlots !== undefined && parseInt(maxSlots, 10) < confirmedCount) {
      return res.status(400).json({
        success: false,
        error: `Cannot reduce maximum slots to ${maxSlots} because there are already ${confirmedCount} confirmed squads.`,
      });
    }

    const updatedName = name !== undefined ? name.trim() : current.name;
    const updatedDesc = description !== undefined ? description.trim() : current.description;
    const updatedDate = date !== undefined ? date : current.date;
    const updatedTime = startTime !== undefined ? startTime.trim() : current.start_time;
    const updatedFee = 40.00;
    const updatedPrize = prizeAmount !== undefined ? parseFloat(prizeAmount) : current.prize_amount;
    const updatedSquadSize = squadSize !== undefined ? parseInt(squadSize, 10) : current.squad_size;
    const updatedMaxSlots = maxSlots !== undefined ? parseInt(maxSlots, 10) : current.max_slots;
    const updatedRules = rules !== undefined ? rules.trim() : current.rules;
    const updatedOpen = registrationOpen !== undefined ? (registrationOpen === true || registrationOpen === 'true') : current.registration_open;

    const updateRes = await query(
      `UPDATE tournaments
       SET name = $1, description = $2, date = $3, start_time = $4, entry_fee = $5,
           prize_amount = $6, squad_size = $7, max_slots = $8, rules = $9, registration_open = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [
        updatedName,
        updatedDesc,
        updatedDate,
        updatedTime,
        updatedFee,
        updatedPrize,
        updatedSquadSize,
        updatedMaxSlots,
        updatedRules,
        updatedOpen,
        id,
      ]
    );

    return res.json({
      success: true,
      message: 'Tournament updated successfully.',
      tournament: updateRes.rows[0],
    });
  } catch (error) {
    console.error('[AdminTournamentController] updateTournament error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update tournament. ' + error.message,
    });
  }
}

// DELETE /api/admin/tournaments/:id - Delete tournament safely
async function deleteTournament(req, res) {
  const { id } = req.params;

  try {
    const checkRes = await query(
      `SELECT COUNT(id) as count FROM registrations WHERE tournament_id = $1 AND (status = 'CONFIRMED' OR payment_status = 'PAID')`,
      [id]
    );

    const paidCount = parseInt(checkRes.rows[0].count || '0', 10);
    if (paidCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete tournament with ${paidCount} confirmed/paid registrations. You can close registration instead.`,
      });
    }

    const paymentHistoryRes = await query(
      `SELECT COUNT(p.id) AS count
       FROM payments p
       JOIN registrations r ON r.id = p.registration_id
       WHERE r.tournament_id = $1`,
      [id]
    );
    if (parseInt(paymentHistoryRes.rows[0].count || '0', 10) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a tournament with payment history. Close registration instead to preserve the audit trail.',
      });
    }

    // Delete pending/draft registrations
    await query(`DELETE FROM registrations WHERE tournament_id = $1`, [id]);
    await query(`DELETE FROM tournaments WHERE id = $1`, [id]);

    return res.json({
      success: true,
      message: 'Tournament deleted successfully.',
    });
  } catch (error) {
    console.error('[AdminTournamentController] deleteTournament error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete tournament.',
    });
  }
}

module.exports = {
  getAdminTournaments,
  createTournament,
  updateTournament,
  deleteTournament,
};
