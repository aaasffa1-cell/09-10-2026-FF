const { query } = require('../database/db');
const { sendRoomCredentialsEmail } = require('../services/emailService');

// POST or PUT /api/admin/tournaments/:id/room - Save / Update Room Credentials
async function saveRoomCredentials(req, res) {
  const { id } = req.params;
  const { roomId, roomPassword } = req.body;

  if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Custom Room ID is required.' });
  }

  if (!roomPassword || typeof roomPassword !== 'string' || roomPassword.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Room Password is required.' });
  }

  try {
    // 1. Verify tournament exists
    const tourneyRes = await query(`SELECT id, name, date, start_time FROM tournaments WHERE id = $1`, [id]);
    if (tourneyRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found.' });
    }

    // 2. Upsert room credentials
    const result = await query(
      `INSERT INTO room_credentials (tournament_id, room_id, room_password)
       VALUES ($1, $2, $3)
       ON CONFLICT (tournament_id) 
       DO UPDATE SET room_id = EXCLUDED.room_id, room_password = EXCLUDED.room_password, updated_at = CURRENT_TIMESTAMP
       RETURNING id, tournament_id, room_id, room_password, updated_at`,
      [id, roomId.trim(), roomPassword.trim()]
    );

    return res.json({
      success: true,
      message: 'Room credentials saved successfully.',
      roomCredentials: {
        tournamentId: result.rows[0].tournament_id,
        roomId: result.rows[0].room_id,
        roomPassword: result.rows[0].room_password,
        updatedAt: result.rows[0].updated_at,
      },
    });
  } catch (error) {
    console.error('[RoomController] saveRoomCredentials error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save room credentials.',
    });
  }
}

// GET /api/admin/tournaments/:id/room - Admin Fetch Room Credentials
async function getRoomCredentials(req, res) {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT rc.*, t.name as tournament_name, t.date, t.start_time
       FROM room_credentials rc
       JOIN tournaments t ON rc.tournament_id = t.id
       WHERE rc.tournament_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        hasCredentials: false,
        roomCredentials: null,
      });
    }

    const row = result.rows[0];
    return res.json({
      success: true,
      hasCredentials: true,
      roomCredentials: {
        tournamentId: row.tournament_id,
        tournamentName: row.tournament_name,
        date: row.date,
        startTime: row.start_time,
        roomId: row.room_id,
        roomPassword: row.room_password,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('[RoomController] getRoomCredentials error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve room credentials.',
    });
  }
}

// POST /api/admin/tournaments/:id/send-room-emails - Manual / Instant Room Email Dispatch (with Duplicate Protection)
async function triggerRoomEmailsManual(req, res) {
  const { id } = req.params;

  try {
    // 1. Fetch tournament & room credentials
    const tourneyRes = await query(
      `SELECT t.*, rc.room_id, rc.room_password
       FROM tournaments t
       LEFT JOIN room_credentials rc ON t.id = rc.tournament_id
       WHERE t.id = $1`,
      [id]
    );

    if (tourneyRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found.' });
    }

    const tournament = tourneyRes.rows[0];

    if (!tournament.room_id || !tournament.room_password) {
      return res.status(400).json({
        success: false,
        error: 'Cannot send room emails: Room ID and Password have not been set for this tournament yet.',
      });
    }

    // 2. Fetch all CONFIRMED registrations
    const confirmedRes = await query(
      `SELECT id, captain_name, captain_email 
       FROM registrations 
       WHERE tournament_id = $1 AND status = 'CONFIRMED'`,
      [id]
    );

    if (confirmedRes.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No confirmed squads found for this tournament yet.',
        dispatchedCount: 0,
        alreadySentCount: 0,
      });
    }

    let dispatchedCount = 0;
    let alreadySentCount = 0;
    let failedCount = 0;

    for (const reg of confirmedRes.rows) {
      // Check if email was already successfully sent
      const logCheck = await query(
        `SELECT id FROM email_logs 
         WHERE registration_id = $1 AND tournament_id = $2 AND email_type = 'ROOM_CREDENTIALS' AND status = 'SENT'`,
        [reg.id, id]
      );

      if (logCheck.rows.length > 0) {
        alreadySentCount++;
        continue;
      }

      try {
        const mailResult = await sendRoomCredentialsEmail(
          reg,
          tournament,
          tournament.room_id,
          tournament.room_password
        );

        // Record in email_logs with unique constraint protection
        await query(
          `INSERT INTO email_logs (registration_id, tournament_id, email_type, recipient_email, status, provider_message_id, sent_at)
           VALUES ($1, $2, 'ROOM_CREDENTIALS', $3, 'SENT', $4, CURRENT_TIMESTAMP)
           ON CONFLICT (registration_id, tournament_id, email_type)
           DO UPDATE SET status = 'SENT', provider_message_id = EXCLUDED.provider_message_id, sent_at = CURRENT_TIMESTAMP, last_error = NULL`,
          [reg.id, id, reg.captain_email, mailResult?.messageId || 'msg_sent']
        );

        dispatchedCount++;
      } catch (sendErr) {
        failedCount++;
        console.error(`[RoomController] Failed to send room email to ${reg.captain_email}:`, sendErr.message);

        // Record failure in email_logs for safe retry later
        await query(
          `INSERT INTO email_logs (registration_id, tournament_id, email_type, recipient_email, status, last_error)
           VALUES ($1, $2, 'ROOM_CREDENTIALS', $3, 'FAILED', $4)
           ON CONFLICT (registration_id, tournament_id, email_type)
           DO UPDATE SET status = 'FAILED', last_error = EXCLUDED.last_error`,
          [reg.id, id, reg.captain_email, sendErr.message]
        ).catch(() => {});
      }
    }

    return res.json({
      success: true,
      message: `Room email dispatch finished. Sent: ${dispatchedCount}, Already sent previously: ${alreadySentCount}, Failed: ${failedCount}`,
      dispatchedCount,
      alreadySentCount,
      failedCount,
    });
  } catch (error) {
    console.error('[RoomController] triggerRoomEmailsManual error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to dispatch room emails.',
    });
  }
}

module.exports = {
  saveRoomCredentials,
  getRoomCredentials,
  triggerRoomEmailsManual,
};
