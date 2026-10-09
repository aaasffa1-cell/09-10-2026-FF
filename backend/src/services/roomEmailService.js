const { query, getClient } = require('../database/db');
const { sendRoomCredentialsEmail } = require('./emailService');

function getRoomEmailLeadMinutes() {
  const value = Number(process.env.ROOM_EMAIL_LEAD_MINUTES || 10);
  if (!Number.isFinite(value) || value < 1 || value > 60) {
    throw new Error('ROOM_EMAIL_LEAD_MINUTES must be between 1 and 60.');
  }
  return value;
}

function parseTournamentDateTime(dateValue, timeValue) {
  const dateText = dateValue instanceof Date
    ? dateValue.toISOString().slice(0, 10)
    : String(dateValue || '').slice(0, 10);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  const match12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(timeValue || '').trim());
  const match24 = /^(\d{1,2}):(\d{2})$/.exec(String(timeValue || '').trim());
  if (!dateMatch || (!match12 && !match24)) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  let hours = Number((match12 || match24)[1]);
  const minutes = Number((match12 || match24)[2]);
  if (match12) {
    if (hours < 1 || hours > 12) return null;
    const meridiem = match12[3].toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }
  if (minutes > 59) return null;

  return new Date(`${dateText}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+05:30`);
}

function getRoomEmailWindow(tournament, now = new Date()) {
  const matchTime = parseTournamentDateTime(tournament.date, tournament.start_time);
  const leadMinutes = getRoomEmailLeadMinutes();
  if (!matchTime) return { allowed: false, reason: 'Tournament date or start time is invalid.' };
  const targetTime = new Date(matchTime.getTime() - leadMinutes * 60 * 1000);
  const differenceMinutes = (matchTime.getTime() - now.getTime()) / 60000;
  const withinWindow = differenceMinutes <= leadMinutes + 0.75 &&
    differenceMinutes >= leadMinutes - 0.75;
  return {
    allowed: withinWindow,
    targetTime,
    matchTime,
    leadMinutes,
    differenceMinutes,
    reason: withinWindow ? null : `Room credentials may only be sent in the ${leadMinutes}-minute pre-match window. Scheduled send time: ${targetTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.`,
  };
}

async function getConfirmedSquads(tournamentId) {
  const result = await query(
    `SELECT r.id, r.captain_name, r.captain_email, r.squad_number,
            el.id AS email_log_id,
           a.email AS initiated_by, el.initiated_at,
           COALESCE(el.status, 'EMAIL_PENDING') AS email_status,
           el.attempts, el.sent_at, el.last_error, el.provider_message_id
    FROM registrations r
     LEFT JOIN email_logs el
       ON el.registration_id = r.id
      AND el.tournament_id = r.tournament_id
      AND el.email_type = 'ROOM_CREDENTIALS'
     LEFT JOIN admins a ON a.id = el.admin_id
     WHERE r.tournament_id = $1 AND r.status = 'CONFIRMED' AND r.email_verified = TRUE
     ORDER BY r.squad_number ASC NULLS LAST, r.id ASC`,
    [tournamentId]
  );
  const squadIds = result.rows.map((squad) => squad.id);
  const attempts = squadIds.length
    ? await query(
      `SELECT rea.registration_id, rea.attempt_number, rea.admin_id,
              a.email AS admin_email, rea.status, rea.initiated_at,
              rea.completed_at, rea.provider_message_id, rea.provider_response, rea.last_error
       FROM room_email_attempts rea
       LEFT JOIN admins a ON a.id = rea.admin_id
       WHERE rea.tournament_id = $1 AND rea.registration_id = ANY($2::int[])
       ORDER BY rea.registration_id, rea.attempt_number DESC`,
      [tournamentId, squadIds]
    )
    : { rows: [] };
  const attemptsBySquad = new Map();
  for (const attempt of attempts.rows) {
    const history = attemptsBySquad.get(attempt.registration_id) || [];
    history.push(attempt);
    attemptsBySquad.set(attempt.registration_id, history);
  }
  return result.rows.map((squad) => ({
    ...squad,
    email_status: squad.email_status === 'SENT' ? 'EMAIL_SENT'
      : squad.email_status === 'FAILED' ? 'EMAIL_FAILED'
        : squad.email_status,
    attemptHistory: attemptsBySquad.get(squad.id) || [],
  }));
}

async function deliverRoomCredentials(squad, tournament, roomId, roomPassword, adminId = null) {
  const client = await getClient();
  let emailLogId;
  let emailAttemptId;
  try {
    await client.query('BEGIN');
    const confirmed = await client.query(
      `SELECT id FROM registrations
       WHERE id = $1 AND tournament_id = $2 AND status = 'CONFIRMED'
       FOR UPDATE`,
      [squad.id, tournament.id]
    );
    if (!confirmed.rows.length) {
      await client.query('ROLLBACK');
      return { status: 'SKIPPED', reason: 'Registration is not confirmed.' };
    }
    const existingLog = await client.query(
      `SELECT id, status FROM email_logs
       WHERE registration_id = $1 AND tournament_id = $2 AND email_type = 'ROOM_CREDENTIALS'
       FOR UPDATE`,
      [squad.id, tournament.id]
    );
    if (existingLog.rows.length) {
      if (!['FAILED', 'EMAIL_FAILED'].includes(existingLog.rows[0].status)) {
        await client.query('COMMIT');
        return { status: 'SKIPPED', reason: 'Delivery is already pending or has already been sent.' };
      }
      const retry = await client.query(
        `UPDATE email_logs
         SET status = 'EMAIL_PENDING', attempts = attempts + 1, admin_id = $1,
             initiated_at = CURRENT_TIMESTAMP, last_error = NULL, provider_response = NULL
         WHERE id = $2 AND status IN ('FAILED', 'EMAIL_FAILED')
         RETURNING id`,
        [adminId, existingLog.rows[0].id]
      );
      if (!retry.rows.length) {
        await client.query('COMMIT');
        return { status: 'SKIPPED', reason: 'Delivery is already pending or has already been sent.' };
      }
      emailLogId = retry.rows[0].id;
    } else {
      const createdLog = await client.query(
        `INSERT INTO email_logs
           (registration_id, tournament_id, email_type, recipient_email, status, attempts, admin_id, initiated_at)
         VALUES ($1, $2, 'ROOM_CREDENTIALS', $3, 'EMAIL_PENDING', 1, $4, CURRENT_TIMESTAMP)
         RETURNING id`,
        [squad.id, tournament.id, squad.captain_email, adminId]
      );
      emailLogId = createdLog.rows[0].id;
    }
    const attemptNumberResult = await client.query(
      `SELECT attempts FROM email_logs WHERE id = $1`,
      [emailLogId]
    );
    const attempt = await client.query(
      `INSERT INTO room_email_attempts
         (registration_id, tournament_id, admin_id, attempt_number, status)
       VALUES ($1, $2, $3, $4, 'EMAIL_PENDING')
       RETURNING id`,
      [squad.id, tournament.id, adminId, attemptNumberResult.rows[0].attempts]
    );
    emailAttemptId = attempt.rows[0].id;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  try {
    const providerResult = await sendRoomCredentialsEmail(squad, tournament, roomId, roomPassword);
    await query(
      `UPDATE email_logs
       SET status = 'EMAIL_SENT', provider_message_id = $1, provider_response = $2,
           sent_at = CURRENT_TIMESTAMP, last_error = NULL
       WHERE id = $3`,
      [providerResult.messageId || null, providerResult.response || null, emailLogId]
    );
    await query(
      `UPDATE room_email_attempts
       SET status = 'EMAIL_SENT', completed_at = CURRENT_TIMESTAMP,
           provider_message_id = $1, provider_response = $2
       WHERE id = $3`,
      [providerResult.messageId || null, providerResult.response || null, emailAttemptId]
    );
    return { status: 'EMAIL_SENT', providerMessageId: providerResult.messageId || null };
  } catch (error) {
    await query(
      `UPDATE email_logs
       SET status = 'EMAIL_FAILED', provider_response = $1, last_error = $1
       WHERE id = $2`,
      [String(error.message || 'Email delivery failed.').slice(0, 2000), emailLogId]
    );
    await query(
      `UPDATE room_email_attempts
       SET status = 'EMAIL_FAILED', completed_at = CURRENT_TIMESTAMP,
           provider_response = $1, last_error = $1
       WHERE id = $2`,
      [String(error.message || 'Email delivery failed.').slice(0, 2000), emailAttemptId]
    );
    console.error(`[RoomEmail] Delivery failed for registration ${squad.id}:`, error);
    return { status: 'EMAIL_FAILED', error: error.message };
  }
}

module.exports = {
  getRoomEmailLeadMinutes,
  parseTournamentDateTime,
  getRoomEmailWindow,
  getConfirmedSquads,
  deliverRoomCredentials,
};
