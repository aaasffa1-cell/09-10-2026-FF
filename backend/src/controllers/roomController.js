const { getClient, query } = require('../database/db');
const {
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
    const client = await getClient();
    let result;
    try {
      await client.query('BEGIN');
      await client.query(
        `SELECT id FROM tournaments WHERE id = $1 FOR UPDATE`,
        [tournamentId]
      );
      const tournament = await client.query(
        `SELECT t.id, rc.room_id, rc.room_password
         FROM tournaments t
         LEFT JOIN room_credentials rc ON rc.tournament_id = t.id
         WHERE t.id = $1`,
        [tournamentId]
      );
      if (!tournament.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Tournament not found.' });
      }
      const existing = tournament.rows[0];
      const credentialsChanged = existing.room_id !== roomId.trim() ||
        existing.room_password !== roomPassword.trim();
      result = await client.query(
        `INSERT INTO room_credentials (tournament_id, room_id, room_password)
         VALUES ($1, $2, $3)
         ON CONFLICT (tournament_id)
         DO UPDATE SET room_id = EXCLUDED.room_id, room_password = EXCLUDED.room_password,
                       updated_at = CURRENT_TIMESTAMP
         RETURNING tournament_id, updated_at`,
        [tournamentId, roomId.trim(), roomPassword.trim()]
      );
      if (credentialsChanged) {
        await client.query(
          `UPDATE email_logs
           SET status = 'EMAIL_FAILED',
               last_error = 'Room credentials were updated; corrected credentials need to be sent.'
           WHERE tournament_id = $1
             AND email_type = 'ROOM_CREDENTIALS'
             AND status = 'EMAIL_SENT'`,
          [tournamentId]
        );
      }
      await client.query(
        `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, metadata)
         VALUES ($1, 'ROOM_CREDENTIALS_SAVED', 'TOURNAMENT', $2, $3::jsonb)`,
        [req.admin.id, tournamentId, JSON.stringify({ changed: credentialsChanged })]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    return res.json({
      success: true,
      message: 'Room credentials saved on the server. Sending remains a manual admin action.',
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
        allowed: true,
        warning: 'Manual sending is available at any time. Sending approximately 10 minutes before the match is recommended.',
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
