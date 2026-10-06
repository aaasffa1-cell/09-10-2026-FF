const cron = require('node-cron');
const { query } = require('../database/db');
const { sendRoomCredentialsEmail } = require('../services/emailService');

// Helper to convert date and start_time (e.g. "08:00 PM" or "20:00") into a Date object in IST
function parseTournamentDateTime(dateStr, timeStr) {
  try {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    // Parse time string like "08:00 PM", "8:00 PM", "20:00"
    let hours = 0;
    let minutes = 0;
    const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);

    if (match12) {
      hours = parseInt(match12[1], 10);
      minutes = parseInt(match12[2], 10);
      const ampm = match12[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    } else if (match24) {
      hours = parseInt(match24[1], 10);
      minutes = parseInt(match24[2], 10);
    } else {
      // Fallback
      return null;
    }

    // Combine in ISO format with IST offset (+05:30)
    const formattedIso = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+05:30`;
    return new Date(formattedIso);
  } catch (err) {
    return null;
  }
}

async function checkAndSendRoomEmails() {
  try {
    const now = new Date();

    // 1. Fetch tournaments that have room credentials and have confirmed squads
    const tourneysRes = await query(`
      SELECT 
        t.id, t.name, t.date, t.start_time,
        rc.room_id, rc.room_password
      FROM tournaments t
      JOIN room_credentials rc ON t.id = rc.tournament_id
      WHERE t.date >= CURRENT_DATE - INTERVAL '1 day'
        AND t.date <= CURRENT_DATE + INTERVAL '1 day'
    `);

    if (tourneysRes.rows.length === 0) {
      return;
    }

    for (const t of tourneysRes.rows) {
      const matchTime = parseTournamentDateTime(t.date, t.start_time);
      if (!matchTime) continue;

      // Difference in minutes between match start time and current time
      const diffMinutes = (matchTime.getTime() - now.getTime()) / (1000 * 60);

      // Trigger if match is starting in <= 10.5 minutes and >= -30 minutes (grace period)
      if (diffMinutes <= 10.5 && diffMinutes >= -30) {
        // Fetch all CONFIRMED registrations that haven't received the room email yet
        const pendingSquadsRes = await query(
          `SELECT r.id, r.captain_name, r.captain_email
           FROM registrations r
           LEFT JOIN email_logs el ON (
             el.registration_id = r.id AND 
             el.tournament_id = r.tournament_id AND 
             el.email_type = 'ROOM_CREDENTIALS' AND 
             el.status = 'SENT'
           )
           WHERE r.tournament_id = $1 
             AND r.status = 'CONFIRMED'
             AND el.id IS NULL`,
          [t.id]
        );

        if (pendingSquadsRes.rows.length > 0) {
          console.log(`[RoomScheduler] Found ${pendingSquadsRes.rows.length} confirmed squads for "${t.name}" (starts in ${Math.round(diffMinutes)} mins). Dispatching credentials...`);

          for (const squad of pendingSquadsRes.rows) {
            try {
              const mailRes = await sendRoomCredentialsEmail(
                squad,
                t,
                t.room_id,
                t.room_password
              );

              // Record in email_logs with unique constraint protection against duplicate sends
              await query(
                `INSERT INTO email_logs (registration_id, tournament_id, email_type, recipient_email, status, provider_message_id, sent_at)
                 VALUES ($1, $2, 'ROOM_CREDENTIALS', $3, 'SENT', $4, CURRENT_TIMESTAMP)
                 ON CONFLICT (registration_id, tournament_id, email_type)
                 DO UPDATE SET status = 'SENT', provider_message_id = EXCLUDED.provider_message_id, sent_at = CURRENT_TIMESTAMP, last_error = NULL`,
                [squad.id, t.id, squad.captain_email, mailRes?.messageId || 'sent_msg']
              );

              console.log(`[RoomScheduler] ✓ Room credentials email sent to ${squad.captain_email} for tournament #${t.id}`);
            } catch (err) {
              console.error(`[RoomScheduler] ✗ Failed to send room email to ${squad.captain_email}:`, err.message);

              await query(
                `INSERT INTO email_logs (registration_id, tournament_id, email_type, recipient_email, status, last_error)
                 VALUES ($1, $2, 'ROOM_CREDENTIALS', $3, 'FAILED', $4)
                 ON CONFLICT (registration_id, tournament_id, email_type)
                 DO UPDATE SET status = 'FAILED', last_error = EXCLUDED.last_error`,
                [squad.id, t.id, squad.captain_email, err.message]
              ).catch(() => {});
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[RoomScheduler] Scheduled job error:', error);
  }
}

function startRoomScheduler() {
  // Run every minute: * * * * *
  const cronJob = cron.schedule('* * * * *', async () => {
    await checkAndSendRoomEmails();
  }, {
    timezone: 'Asia/Kolkata',
  });

  console.log('[RoomScheduler] Cron job initialized (runs every 60s in Asia/Kolkata timezone).');
  return cronJob;
}

module.exports = {
  startRoomScheduler,
  checkAndSendRoomEmails,
  parseTournamentDateTime,
};
