const express = require('express');
const router = express.Router();
const { checkAndSendRoomEmails } = require('../jobs/roomScheduler');

// GET /api/cron/check-rooms - Vercel Cron Job Trigger (Runs every minute)
router.get('/check-rooms', async (req, res) => {
  // Optional cron authorization check
  const authHeader = req.headers['authorization'];
  if (process.env.NODE_ENV === 'production' && !process.env.CRON_SECRET) {
    return res.status(503).json({ success: false, error: 'Cron authentication is not configured.' });
  }
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized cron request' });
  }

  try {
    console.log('[VercelCron] Checking tournaments approaching 10-min match window...');
    await checkAndSendRoomEmails();
    return res.json({
      success: true,
      message: 'Room credentials cron executed successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[VercelCron] Error executing room check:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
