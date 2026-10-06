const express = require('express');
const router = express.Router();
const { login, logout, getMe } = require('../controllers/adminAuthController');
const { 
  getAdminTournaments, 
  createTournament, 
  updateTournament, 
  deleteTournament 
} = require('../controllers/adminTournamentController');
const { getRegistrations, getDashboardStats } = require('../controllers/adminRegistrationController');
const { 
  saveRoomCredentials, 
  getRoomCredentials, 
  triggerRoomEmailsManual 
} = require('../controllers/roomController');
const { requireAdminAuth } = require('../middleware/authMiddleware');
const { validateTournamentInput } = require('../middleware/validateMiddleware');
const { adminLoginLimiter } = require('../middleware/rateLimiter');

// Public admin authentication
router.post('/login', adminLoginLimiter, login);

// Protected Admin Routes
router.use(requireAdminAuth);

router.post('/logout', logout);
router.get('/me', getMe);
router.get('/stats', getDashboardStats);

// Tournaments Management
router.get('/tournaments', getAdminTournaments);
router.post('/tournaments', validateTournamentInput, createTournament);
router.put('/tournaments/:id', updateTournament);
router.delete('/tournaments/:id', deleteTournament);

// Registrations Management
router.get('/registrations', getRegistrations);

// Room Credentials Management
router.get('/tournaments/:id/room', getRoomCredentials);
router.post('/tournaments/:id/room', saveRoomCredentials);
router.put('/tournaments/:id/room', saveRoomCredentials);
router.post('/tournaments/:id/send-room-emails', triggerRoomEmailsManual);

module.exports = router;
