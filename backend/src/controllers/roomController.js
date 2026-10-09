const { query } = require('../database/db');
const {
  getRoomEmailWindow,
  getConfirmedSquads,
  deliverRoomCredentials,
} = require('../services/roomEmailService');

async function saveRoomCredentials(req, res) {
  const tournamentId = Number(req.params.id);
  const { roomId, roomPassword } = req.body || {};
  if (!Number.isSafeInteger(tournamentId) || tournamentId < 1) {
    return res.status(400).json({ success: false, error: 'A valid tournament is required.' });
  }
  if (typeof roomId !== 'string' || !roomId.trim() || roomId.trim().length > 100 ||
      typeof roomPassword !== 'string' || !roomPassword.trim() || roomPassword.trim().length > 100) {
    return res.status(400).json({ success: false, error: 'Room ID and password are required (maximum 100 characters each).' });
  }

  try {
    const tournament = await query(`SELECT id FROM tournaments WHERE id = $1`, [tournamentId]);
    if (!tournament.rows.length) return res.status(404).json({ success: false, error: 'Tournament not found.' });
    const result = await query(
      `INSERT INTO room_credentials (tournament_id, room_id, room_password)
       VALUES ($1, $2, $3)
       ON CONFLICT (tournament_id)
       DO UPDATE SET room_id = EXCLUDED.room_id, room_password = EXCLUDED.room_password,
                     updated_at = CURRENT_TIMESTAMP
       RETURNING tournament_id, updated_at`,
      [tournamentId, roomId.trim(), roomPassword.trim()]
    );
    return res.json({
      success: true,
      message: 'Room credentials saved on the server. They are not sent until the authorized pre-match window.',
      roomCredentials: { tournamentId: result.rows[0].tournament_id, updatedAt: result.rows[0].updated_at },
    });
  } catch (error) {
    console.error('[RoomController] saveRoomCredentials error:', error);
    return res.status(500).json({ success: false, error: 'Failed to save room credentials.' });
  }
}

async function getRoomCredentials(req, res) {
  const tournamentId = Number(req.params.id);
  if (!Number.isSafeInteger(tournamentId) || tournamentId < 1) {
    return res.status(400).json({ success: false, error: 'A valid tournament is required.' });
  }
  try {
    const result = await query(
      `SELECT rc.tournament_id, rc.room_id, rc.room_password, rc.updated_at,
              t.name AS tournament_name, t.date, t.start_time
       FROM tournaments t
       LEFT JOIN room_credentials rc ON rc.tournament_id = t.id
       WHERE t.id = $1`,
      [tournamentId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Tournament not found.' });

    const row = result.rows[0];
    const window = getRoomEmailWindow(row);
    const deliveries = await getConfirmedSquads(tournamentId);
    return res.json({
      success: true,
      hasCredentials: Boolean(row.room_id && row.room_password),
      roomCredentials: row.room_id ? {
        tournamentId: row.tournament_id,
        tournamentName: row.tournament_name,
        date: row.date,
        startTime: row.start_time,
        roomId: row.room_id,
        roomPassword: row.room_password,
        updatedAt: row.updated_at,
      } : null,
      sendWindow: {
        allowed: window.allowed,
        targetTime: window.targetTime || null,
        leadMinutes: window.leadMinutes,
        warning: window.reason || null,
      },
      deliveries,
    });
  } catch (error) {
    console.error('[RoomController] getRoomCredentials error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve room credential details.' });
  }
}

async function triggerRoomEmailsManual(req, res) {
  const tournamentId = Number(req.params.id);
  if (!Number.isSafeInteger(tournamentId) || tournamentId < 1) {
    return res.status(400).json({ success: false, error: 'A valid tournament is required.' });
  }
  try {
    const result = await query(
      `SELECT t.id, t.name, t.date, t.start_time, rc.room_id, rc.room_password
       FROM tournaments t
       LEFT JOIN room_credentials rc ON rc.tournament_id = t.id
       WHERE t.id = $1`,
      [tournamentId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Tournament not found.' });
    const tournament = result.rows[0];
    if (!tournament.room_id || !tournament.room_password) {
      return res.status(400).json({ success: false, error: 'Save the room ID and password before sending.' });
    }
    const window = getRoomEmailWindow(tournament);
    if (!window.allowed) {
      return res.status(409).json({
        success: false,
        code: 'OUTSIDE_ROOM_EMAIL_WINDOW',
        error: window.reason || 'Room credentials cannot be sent at this time.',
        sendAt: window.targetTime || null,
      });
    }

    const squads = await getConfirmedSquads(tournamentId);
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const squad of squads) {
      const delivery = await deliverRoomCredentials(
        squad,
        tournament,
        tournament.room_id,
        tournament.room_password,
        req.admin.id
      );
      if (delivery.status === 'EMAIL_SENT') sent += 1;
      else if (delivery.status === 'EMAIL_FAILED') failed += 1;
      else skipped += 1;
    }
    return res.json({
      success: true,
      message: `Room email send completed. Sent: ${sent}, failed: ${failed}, skipped/already sent: ${skipped}.`,
      sent,
      failed,
      skipped,
    });
  } catch (error) {
    console.error('[RoomController] triggerRoomEmailsManual error:', error);
    return res.status(500).json({ success: false, error: 'Failed to dispatch room emails.' });
  }
}

module.exports = { saveRoomCredentials, getRoomCredentials, triggerRoomEmailsManual };
