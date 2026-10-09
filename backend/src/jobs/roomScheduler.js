const cron = require('node-cron');
const { query } = require('../database/db');
const {
  parseTournamentDateTime,
  getRoomEmailWindow,
  getConfirmedSquads,
  deliverRoomCredentials,
} = require('../services/roomEmailService');

async function checkAndSendRoomEmails(now = new Date()) {
  try {
    const tournaments = await query(`
      SELECT t.id, t.name, t.date, t.start_time, rc.room_id, rc.room_password
      FROM tournaments t
      JOIN room_credentials rc ON rc.tournament_id = t.id
      WHERE t.date >= CURRENT_DATE - INTERVAL '1 day'
        AND t.date <= CURRENT_DATE + INTERVAL '1 day'
    `);

    for (const tournament of tournaments.rows) {
      const window = getRoomEmailWindow(tournament, now);
      if (!window.allowed || !tournament.room_id || !tournament.room_password) continue;

      const squads = await getConfirmedSquads(tournament.id);
      for (const squad of squads) {
        if (squad.email_status === 'EMAIL_SENT' ||
            (squad.email_status === 'EMAIL_PENDING' && squad.email_log_id && Number(squad.attempts) > 0)) continue;
        const result = await deliverRoomCredentials(
          squad,
          tournament,
          tournament.room_id,
          tournament.room_password
        );
        console.log(`[RoomScheduler] ${result.status} room email for squad ${squad.squad_number || squad.id} in tournament ${tournament.id}.`);
      }
    }
  } catch (error) {
    console.error('[RoomScheduler] Scheduled job error:', error);
    throw error;
  }
}

function startRoomScheduler() {
  const cronJob = cron.schedule('* * * * *', async () => {
    try {
      await checkAndSendRoomEmails();
    } catch (error) {
      console.error('[RoomScheduler] Cron invocation failed:', error.message);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('[RoomScheduler] Room credential scheduler initialized (Asia/Kolkata).');
  return cronJob;
}

module.exports = {
  startRoomScheduler,
  checkAndSendRoomEmails,
  parseTournamentDateTime,
};
