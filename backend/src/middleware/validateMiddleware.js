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

  // New registrations need only captain details; legacy four-player payloads remain supported.
  if (players !== undefined && (!Array.isArray(players) || ![1, 4].includes(players.length))) {
    errors.push('Provide captain details only, or use the legacy four-player registration format.');
  } else if (Array.isArray(players)) {
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
  req.body.players = Array.isArray(players)
    ? players.map(p => ({
      fullName: p.fullName.trim(),
      freeFireId: p.freeFireId.trim(),
    }))
    : [{ fullName: req.body.captainName, freeFireId: req.body.captainFreeFireId.trim() }];

  next();
}

function validateTournamentInput(req, res, next) {
  const { name, date, startTime, entryFee, prizeAmount, squadSize, maxSlots } = req.body;
  const isCreate = req.method === 'POST';
  const dateIsValid = typeof date === 'string' && !Number.isNaN(Date.parse(date));
  const errors = [];

  if ((isCreate && (!name || typeof name !== 'string')) ||
      (name !== undefined && (typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 150))) {
    errors.push('Tournament name is required (min 3 characters).');
  }

  if ((isCreate && !date) || (date !== undefined && !dateIsValid)) {
    errors.push('Valid tournament date is required.');
  }

  if ((isCreate && !startTime) ||
      (startTime !== undefined && (typeof startTime !== 'string' || startTime.trim().length < 2 || startTime.trim().length > 30))) {
    errors.push('Valid tournament start time is required (e.g. "08:00 PM").');
  }

  if ((isCreate && entryFee === undefined) ||
      (entryFee !== undefined && (!Number.isFinite(Number(entryFee)) || Number(entryFee) <= 0))) {
    errors.push('Entry fee must be a valid amount greater than zero.');
  }

  if ((isCreate && (prizeAmount === undefined || String(prizeAmount).trim() === '')) ||
      (prizeAmount !== undefined && (!Number.isFinite(Number(prizeAmount)) || Number(prizeAmount) < 0))) {
    errors.push('Prize amount must be a valid non-negative number.');
  }

  if (squadSize !== undefined && (!Number.isInteger(Number(squadSize)) || Number(squadSize) !== 4)) {
    errors.push('Squad size must be 4 for standard squad BR tournaments.');
  }

  if ((isCreate && maxSlots === undefined) ||
      (maxSlots !== undefined && (!Number.isInteger(Number(maxSlots)) || Number(maxSlots) < 1 || Number(maxSlots) > 10000))) {
    errors.push('Maximum squad capacity must be a whole number between 1 and 10,000.');
  }

  const { registrationDeadline } = req.body;
  if (isCreate && (typeof registrationDeadline !== 'string' || !registrationDeadline.trim())) {
    errors.push('Registration deadline is required.');
  }
  if (registrationDeadline !== undefined && registrationDeadline !== null && registrationDeadline !== '' &&
      (typeof registrationDeadline !== 'string' || Number.isNaN(Date.parse(registrationDeadline)))) {
    errors.push('Enter a valid registration deadline.');
  } else if (registrationDeadline && dateIsValid) {
    const matchDate = new Date(date).toISOString().slice(0, 10);
    const deadlineDate = new Date(registrationDeadline).toISOString().slice(0, 10);
    if (deadlineDate > matchDate) errors.push('The registration deadline must be on or before the match date.');
  }

  for (const [field, maxLength] of [
    ['description', 5000],
    ['rules', 10000],
    ['map', 100],
    ['gameMode', 100],
    ['eligibilityRequirements', 5000],
  ]) {
    const value = req.body[field];
    if (isCreate && ['rules', 'map', 'gameMode', 'eligibilityRequirements'].includes(field) &&
        (typeof value !== 'string' || !value.trim())) {
      errors.push(`${field} is required.`);
    }
    if (value !== undefined && value !== null &&
        (typeof value !== 'string' || value.length > maxLength)) {
      errors.push(`${field} must be text with no more than ${maxLength} characters.`);
    }
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
