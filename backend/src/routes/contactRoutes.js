const express = require('express');
const router = express.Router();
const { submitContactMessage } = require('../controllers/contactController');
const { validateContactMessage } = require('../middleware/validateMiddleware');
const { contactMessageLimiter } = require('../middleware/rateLimiter');

router.post('/', contactMessageLimiter, validateContactMessage, submitContactMessage);

module.exports = router;
