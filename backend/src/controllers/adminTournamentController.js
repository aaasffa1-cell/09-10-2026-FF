const { getClient, query } = require('../database/db');

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
        tournaments.registration_deadline,
        tournaments.map,
        tournaments.game_mode,
        tournaments.eligibility_requirements,
        tournaments.tournament_status,
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
      maxSlots: Number(t.max_slots),
      confirmedSlots: parseInt(t.confirmed_slots || '0', 10),
      totalRegistrations: parseInt(t.total_registrations || '0', 10),
      availableSlots: Math.max(0, Number(t.max_slots) - parseInt(t.confirmed_slots || '0', 10)),
      rules: t.rules,
      registrationOpen: t.registration_open,
      registrationDeadline: t.registration_deadline,
      map: t.map,
      gameMode: t.game_mode,
      eligibilityRequirements: t.eligibility_requirements,
      status: t.tournament_status,
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
    entryFee,
    prizeAmount,
    squadSize = 4,
    maxSlots = 13,
    rules,
    registrationDeadline,
    map,
    gameMode,
    eligibilityRequirements,
    registrationOpen = true,
  } = req.body;

  try {
    if (!Number.isFinite(Number(entryFee)) || Number(entryFee) <= 0) {
      return res.status(400).json({ success: false, error: 'Enter an entry fee greater than zero.' });
    }
    if (!Number.isFinite(Number(prizeAmount)) || Number(prizeAmount) < 0) {
      return res.status(400).json({ success: false, error: 'Enter a valid prize amount.' });
    }
    if (!Number.isSafeInteger(Number(maxSlots)) || Number(maxSlots) < 1) {
      return res.status(400).json({ success: false, error: 'Enter a valid squad capacity.' });
    }
    const result = await query(
      `INSERT INTO tournaments
         (name, description, date, start_time, entry_fee, prize_amount, squad_size, max_slots, rules,
          registration_open, registration_deadline, map, game_mode, eligibility_requirements)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        name.trim(),
        description ? description.trim() : '',
        date,
        startTime.trim(),
        Number(entryFee),
        Number(prizeAmount),
        parseInt(squadSize, 10) || 4,
        Number(maxSlots),
        rules ? rules.trim() : '',
        registrationOpen === true || registrationOpen === 'true',
        registrationDeadline || null,
        map ? map.trim() : null,
        gameMode ? gameMode.trim() : null,
        eligibilityRequirements ? eligibilityRequirements.trim() : null,
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
      error: 'Failed to create tournament.',
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
    registrationDeadline,
    map,
    gameMode,
    eligibilityRequirements,
    registrationOpen,
  } = req.body;

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
    if (entryFee !== undefined && Number(entryFee) !== Number(current.entry_fee)) {
      return res.status(409).json({
        success: false,
        error: 'The published entry fee cannot be changed. Existing payment amounts are preserved.',
      });
    }

    const updatedName = name !== undefined ? name.trim() : current.name;
    const updatedDesc = description !== undefined ? description.trim() : current.description;
    const updatedDate = date !== undefined ? date : current.date;
    const updatedTime = startTime !== undefined ? startTime.trim() : current.start_time;
    const updatedFee = current.entry_fee;
    const updatedPrize = prizeAmount !== undefined ? parseFloat(prizeAmount) : current.prize_amount;
    const updatedSquadSize = squadSize !== undefined ? parseInt(squadSize, 10) : current.squad_size;
    const updatedMaxSlots = maxSlots !== undefined ? parseInt(maxSlots, 10) : current.max_slots;
    const updatedRules = rules !== undefined ? rules.trim() : current.rules;
    const updatedOpen = registrationOpen !== undefined ? (registrationOpen === true || registrationOpen === 'true') : current.registration_open;
    const updatedDeadline = registrationDeadline !== undefined ? (registrationDeadline || null) : current.registration_deadline;
    const updatedMap = map !== undefined ? map.trim() : current.map;
    const updatedGameMode = gameMode !== undefined ? gameMode.trim() : current.game_mode;
    const updatedEligibility = eligibilityRequirements !== undefined
      ? eligibilityRequirements.trim()
      : current.eligibility_requirements;

    const updateRes = await query(
      `UPDATE tournaments
       SET name = $1, description = $2, date = $3, start_time = $4, entry_fee = $5,
           prize_amount = $6, squad_size = $7, max_slots = $8, rules = $9, registration_open = $10,
           registration_deadline = $11, map = $12, game_mode = $13, eligibility_requirements = $14,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $15
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
        updatedDeadline,
        updatedMap,
        updatedGameMode,
        updatedEligibility,
        id,
      ]
    );

    return res.json({
      success: true,
      message: 'Tournament updated successfully.',
      capacityWarning: updatedMaxSlots < confirmedCount
        ? `Capacity is now below the ${confirmedCount} already-confirmed squads. Existing confirmations are preserved and no new slots can be confirmed.`
        : null,
      tournament: updateRes.rows[0],
    });
  } catch (error) {
    console.error('[AdminTournamentController] updateTournament error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update tournament.',
    });
  }
}

// DELETE /api/admin/tournaments/:id - Delete tournament safely
async function deleteTournament(req, res) {
  const { id } = req.params;

  try {
    const client = await getClient();
    let affectedHistory = false;
    try {
      await client.query('BEGIN');
      const tournament = await client.query(
        `SELECT id, name, tournament_status, registration_open
         FROM tournaments WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (!tournament.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Tournament not found.' });
      }
      const history = await client.query(
        `SELECT
           EXISTS (SELECT 1 FROM registrations WHERE tournament_id = $1) AS has_registrations,
           EXISTS (SELECT 1 FROM payments WHERE tournament_id = $1) AS has_payments,
           EXISTS (SELECT 1 FROM room_credentials WHERE tournament_id = $1) AS has_room_credentials,
           EXISTS (SELECT 1 FROM tournament_results WHERE tournament_id = $1) AS has_results`,
        [id]
      );
      affectedHistory = Object.values(history.rows[0]).some(Boolean);
      if (affectedHistory) {
        await client.query(
          `UPDATE tournaments SET registration_open = FALSE, tournament_status = 'CANCELLED',
             updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [id]
        );
        await client.query(
          `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'TOURNAMENT_CANCELLED', 'TOURNAMENT', $2, $3::jsonb)`,
          [
            req.admin.id,
            id,
            JSON.stringify({
              name: tournament.rows[0].name,
              previousStatus: tournament.rows[0].tournament_status,
              registrationWasOpen: tournament.rows[0].registration_open,
            }),
          ]
        );
      } else {
        await client.query(`DELETE FROM tournaments WHERE id = $1`, [id]);
        await client.query(
          `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'TOURNAMENT_DELETED', 'TOURNAMENT', $2, $3::jsonb)`,
          [req.admin.id, id, JSON.stringify({ name: tournament.rows[0].name })]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    return res.json({
      success: true,
      message: affectedHistory
        ? 'Tournament cancelled. Registration, payment, and match history have been preserved.'
        : 'Tournament deleted successfully.',
      cancelled: affectedHistory,
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
