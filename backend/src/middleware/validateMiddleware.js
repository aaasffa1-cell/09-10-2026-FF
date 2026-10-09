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

  if (entryFee !== undefined && Number(entryFee) !== 40) {
    errors.push('The team registration fee is fixed at ₹40.');
  }

  if (prizeAmount !== undefined && (isNaN(Number(prizeAmount)) || Number(prizeAmount) < 0)) {
    errors.push('Prize amount must be a valid non-negative number.');
  }

  if (squadSize !== undefined && (isNaN(parseInt(squadSize, 10)) || parseInt(squadSize, 10) !== 4)) {
    errors.push('Squad size must be 4 for standard squad BR tournaments.');
  }

  if (maxSlots !== undefined && (isNaN(parseInt(maxSlots, 10)) || parseInt(maxSlots, 10) < 1 || parseInt(maxSlots, 10) > 13)) {
    errors.push('Maximum capacity is 13 squads (52 players).');
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

function validateContactMessage(req, res, next) {
  const { name, email, subject, message } = req.body;

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return res.status(400).json({ success: false, error: 'Name must be between 2 and 100 characters.' });
  }

  if (typeof email !== 'string' || !validator.isEmail(email.trim())) {
    return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
  }

  if (typeof subject !== 'string' || subject.trim().length < 2 || subject.trim().length > 150) {
    return res.status(400).json({ success: false, error: 'Subject must be between 2 and 150 characters.' });
  }

  if (typeof message !== 'string' || message.trim().length < 5 || message.trim().length > 5000) {
    return res.status(400).json({ success: false, error: 'Message must be between 5 and 5000 characters.' });
  }

  req.body.name = name.trim();
  req.body.email = email.trim().toLowerCase();
  req.body.subject = subject.trim().replace(/[\r\n]+/g, ' ');
  req.body.message = message.trim();
  return next();
}

module.exports = {
  validateRegistrationInput,
  validateTournamentInput,
  validateContactMessage,
};
