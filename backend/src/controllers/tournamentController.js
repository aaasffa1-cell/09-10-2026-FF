const { query } = require('../database/db');

// Helper to compute tournament registration status
function computeTournamentStatus(t) {
  const confirmedSlots = parseInt(t.confirmed_slots || '0', 10);
  const maxSlots = parseInt(t.max_slots || '13', 10);

  if (t.tournament_status === 'CANCELLED') {
    return 'CANCELLED';
  }

  if (!t.registration_open ||
      (t.registration_deadline && new Date(t.registration_deadline) <= new Date())) {
    return 'REGISTRATION_CLOSED';
  }

  if (confirmedSlots >= maxSlots) {
    return 'SLOTS_FULL';
  }

  return 'OPEN';
}

// GET /api/tournaments - Public list
async function getAllTournaments(req, res) {
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
        tournaments.registration_deadline,
        tournaments.map,
        tournaments.game_mode,
        tournaments.eligibility_requirements,
        tournaments.tournament_status,
        tournaments.registration_open,
        tournaments.created_at,
        COALESCE(sub.confirmed_slots, 0) AS confirmed_slots
      FROM tournaments
      LEFT JOIN (
        SELECT tournament_id, COUNT(id) AS confirmed_slots
        FROM registrations
        WHERE status = 'CONFIRMED'
        GROUP BY tournament_id
      ) sub ON sub.tournament_id = tournaments.id
      ORDER BY tournaments.date ASC, tournaments.start_time ASC
    `);

    const tournaments = result.rows.map(t => {
      const confirmedSlots = parseInt(t.confirmed_slots || '0', 10);
      const maxSlots = parseInt(t.max_slots || '13', 10);
      const status = computeTournamentStatus(t);

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        date: t.date,
        startTime: t.start_time,
        entryFee: parseFloat(t.entry_fee),
        prizeAmount: parseFloat(t.prize_amount),
        squadSize: t.squad_size,
        maxSlots: maxSlots,
        confirmedSlots: confirmedSlots,
        availableSlots: Math.max(0, maxSlots - confirmedSlots),
        rules: t.rules,
        registrationDeadline: t.registration_deadline,
        map: t.map,
        gameMode: t.game_mode,
        eligibilityRequirements: t.eligibility_requirements,
        registrationOpen: t.registration_open,
        status: status, // OPEN | SLOTS_FULL | REGISTRATION_CLOSED
      };
    });

    return res.json({
      success: true,
      tournaments,
    });
  } catch (error) {
    console.error('[TournamentController] getAllTournaments error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tournaments. Please try again later.',
    });
  }
}

// GET /api/tournaments/:id - Public details
async function getTournamentById(req, res) {
  try {
    const { id } = req.params;

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
        tournaments.registration_deadline,
        tournaments.map,
        tournaments.game_mode,
        tournaments.eligibility_requirements,
        tournaments.tournament_status,
        tournaments.registration_open,
        tournaments.created_at,
        COALESCE(sub.confirmed_slots, 0) AS confirmed_slots
      FROM tournaments
      LEFT JOIN (
        SELECT tournament_id, COUNT(id) AS confirmed_slots
        FROM registrations
        WHERE status = 'CONFIRMED'
        GROUP BY tournament_id
      ) sub ON sub.tournament_id = tournaments.id
      WHERE tournaments.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found.',
      });
    }

    const t = result.rows[0];
    const confirmedSlots = parseInt(t.confirmed_slots || '0', 10);
    const maxSlots = parseInt(t.max_slots || '13', 10);
    const status = computeTournamentStatus(t);

    return res.json({
      success: true,
      tournament: {
        id: t.id,
        name: t.name,
        description: t.description,
        date: t.date,
        startTime: t.start_time,
        entryFee: parseFloat(t.entry_fee),
        prizeAmount: parseFloat(t.prize_amount),
        squadSize: t.squad_size,
        maxSlots: maxSlots,
        confirmedSlots: confirmedSlots,
        availableSlots: Math.max(0, maxSlots - confirmedSlots),
        rules: t.rules,
        registrationDeadline: t.registration_deadline,
        map: t.map,
        gameMode: t.game_mode,
        eligibilityRequirements: t.eligibility_requirements,
        registrationOpen: t.registration_open,
        status: status,
      },
    });
  } catch (error) {
    console.error('[TournamentController] getTournamentById error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tournament details.',
    });
  }
}

module.exports = {
  getAllTournaments,
  getTournamentById,
};
