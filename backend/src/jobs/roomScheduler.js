const {
  parseTournamentDateTime,
  getRoomEmailWindow,
} = require('../services/roomEmailService');

async function checkAndSendRoomEmails() {
  const error = new Error('Automatic room credential delivery is disabled. Use the admin match-control action.');
  error.code = 'MANUAL_DISPATCH_REQUIRED';
  throw error;
}

module.exports = {
  checkAndSendRoomEmails,
  parseTournamentDateTime,
  getRoomEmailWindow,
};
