const express = require('express');

const router = express.Router();

router.all('/check-rooms', (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Automatic room credential delivery is disabled. Use the admin match-control action.',
  });
});

module.exports = router;
