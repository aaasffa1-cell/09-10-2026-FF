const express = require('express');
const router = express.Router();
const { requestOtp, verifyOtp, logout, getMe } = require('../controllers/adminAuthController');
const { 
  getAdminTournaments, 
  createTournament, 
  updateTournament, 
  deleteTournament 
} = require('../controllers/adminTournamentController');
const {
  getRegistrations,
  getDashboardStats,
  getPaymentEvents,
} = require('../controllers/adminRegistrationController');
const {
  getPaymentsForAdmin,
  verifyPayment,
  rejectPayment,
} = require('../controllers/paymentController');
const { 
  saveRoomCredentials, 
  getRoomCredentials, 
  triggerRoomEmailsManual 
} = require('../controllers/roomController');
const { requireAdminAuth } = require('../middleware/authMiddleware');
const { getAdminResults, saveTournamentResult } = require('../controllers/resultController');
const { validateTournamentInput } = require('../middleware/validateMiddleware');
const { adminLoginLimiter } = require('../middleware/rateLimiter');

// Public admin authentication
router.post('/request-otp', adminLoginLimiter, requestOtp);
router.post('/verify-otp', adminLoginLimiter, verifyOtp);

// Protected Admin Routes
router.use(requireAdminAuth);

router.post('/logout', logout);
router.get('/me', getMe);
router.get('/stats', getDashboardStats);
router.get('/results', getAdminResults);
router.put('/tournaments/:tournamentId/results', saveTournamentResult);

// Tournaments Management
router.get('/tournaments', getAdminTournaments);
router.post('/tournaments', validateTournamentInput, createTournament);
router.put('/tournaments/:id', validateTournamentInput, updateTournament);
router.delete('/tournaments/:id', deleteTournament);

// Registrations Management
router.get('/registrations', getRegistrations);
router.get('/payments', getPaymentsForAdmin);
router.get('/payments/:paymentId/events', getPaymentEvents);
router.post('/payments/:paymentId/verify', verifyPayment);
router.post('/payments/:paymentId/reject', rejectPayment);

// Room Credentials Management
router.get('/tournaments/:id/room', getRoomCredentials);
router.post('/tournaments/:id/room', saveRoomCredentials);
router.put('/tournaments/:id/room', saveRoomCredentials);
router.post('/tournaments/:id/send-room-emails', triggerRoomEmailsManual);

module.exports = router;
