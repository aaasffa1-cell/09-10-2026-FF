const validator = require('validator');

function validateRegistrationInput(req, res, next) {
  const { tournamentId, captainName, captainEmail, captainPhone, captainFreeFireId, players } = req.body;

  const errors = [];

  // Tournament ID
  if (!tournamentId || isNaN(parseInt(tournamentId, 10))) {
    errors.push('Valid tournament ID is required.');
  }

  // Captain details
  if (!captainName || typeof captainName !== 'string' || captainName.trim().length < 2) {
    errors.push('Captain full name must be at least 2 characters.');
  }

  if (!captainEmail || !validator.isEmail(captainEmail.trim())) {
    errors.push('A valid captain email address is required.');
  }

  if (!captainPhone || typeof captainPhone !== 'string' || captainPhone.trim().replace(/\D/g, '').length < 10) {
    errors.push('A valid 10-digit mobile number is required.');
  }

  if (!captainFreeFireId || typeof captainFreeFireId !== 'string' || captainFreeFireId.trim().length < 3) {
    errors.push('Captain Free Fire UID/ID is required (min 3 characters).');
  }

  // Players validation (Squad must have exactly 4 players)
  if (!Array.isArray(players) || players.length !== 4) {
    errors.push('Registration must contain exactly 4 players in the squad.');
  } else {
    const ffIds = new Set();

    players.forEach((player, index) => {
      const pNum = index + 1;
      if (!player.fullName || typeof player.fullName !== 'string' || player.fullName.trim().length < 2) {
        errors.push(`Player ${pNum} name must be at least 2 characters.`);
      }

      if (!player.freeFireId || typeof player.freeFireId !== 'string' || player.freeFireId.trim().length < 3) {
        errors.push(`Player ${pNum} Free Fire ID is required.`);
      } else {
        const cleanFfId = player.freeFireId.trim().toLowerCase();
        if (ffIds.has(cleanFfId)) {
          errors.push(`Duplicate Free Fire ID detected in squad: "${player.freeFireId}". Each squad player must have a unique Free Fire ID.`);
        }
        ffIds.add(cleanFfId);
      }
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: errors[0],
      errors,
    });
  }

  // Sanitize body strings
  req.body.captainName = captainName.trim();
  req.body.captainEmail = captainEmail.trim().toLowerCase();
  req.body.captainPhone = captainPhone.trim();
  req.body.captainFreeFireId = captainFreeFireId.trim();
  req.body.players = players.map(p => ({
    fullName: p.fullName.trim(),
    freeFireId: p.freeFireId.trim(),
  }));

  next();
}

function validateTournamentInput(req, res, next) {
  const { name, date, startTime, entryFee, prizeAmount, squadSize, maxSlots } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 3) {
    errors.push('Tournament name is required (min 3 characters).');
  }

  if (!date || isNaN(Date.parse(date))) {
    errors.push('Valid tournament date is required.');
  }

  if (!startTime || typeof startTime !== 'string' || startTime.trim().length < 2) {
    errors.push('Valid tournament start time is required (e.g. "08:00 PM").');
  }

  if (entryFee !== undefined && (isNaN(Number(entryFee)) || Number(entryFee) < 0)) {
    errors.push('Entry fee must be a valid non-negative number.');
  }

  if (prizeAmount !== undefined && (isNaN(Number(prizeAmount)) || Number(prizeAmount) < 0)) {
    errors.push('Prize amount must be a valid non-negative number.');
  }

  if (squadSize !== undefined && (isNaN(parseInt(squadSize, 10)) || parseInt(squadSize, 10) !== 4)) {
    errors.push('Squad size must be 4 for standard squad BR tournaments.');
  }

  if (maxSlots !== undefined && (isNaN(parseInt(maxSlots, 10)) || parseInt(maxSlots, 10) < 1 || parseInt(maxSlots, 10) > 100)) {
    errors.push('Maximum slots must be between 1 and 100 squads.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: errors[0],
      errors,
    });
  }

  next();
}

module.exports = {
  validateRegistrationInput,
  validateTournamentInput,
};
