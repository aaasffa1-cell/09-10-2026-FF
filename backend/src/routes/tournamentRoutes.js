const express = require('express');
const router = express.Router();
const { getAllTournaments, getTournamentById } = require('../controllers/tournamentController');
const { getPublishedResults } = require('../controllers/resultController');

// Public tournament routes
router.get('/results', getPublishedResults);
router.get('/', getAllTournaments);
router.get('/:id', getTournamentById);

module.exports = router;
