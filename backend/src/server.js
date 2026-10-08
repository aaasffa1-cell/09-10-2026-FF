require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initDb, runMigrations } = require('./database/db');
const { generalLimiter } = require('./middleware/rateLimiter');
const { getSessionSecret } = require('./middleware/authMiddleware');
const { startRoomScheduler } = require('./jobs/roomScheduler');

const tournamentRoutes = require('./routes/tournamentRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const contactRoutes = require('./routes/contactRoutes');

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// CORS Configuration
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean),
  ...(process.env.NODE_ENV === 'production' || !process.env.NODE_ENV
    ? []
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://127.0.0.1:5173']),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman) or matched origins
    if (
      !origin ||
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS policy'));
  },
  credentials: true,
}));

// Body Parsers
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// General Rate Limiting
app.use('/api', generalLimiter);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Free Fire Arena API',
    timestamp: new Date().toISOString(),
    timezone: process.env.TZ || 'Asia/Kolkata',
  });
});

// Cron Endpoint (For Vercel Cron or external scheduler pingers)
const { checkAndSendRoomEmails } = require('./jobs/roomScheduler');
app.all('/api/cron/check-rooms', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (process.env.NODE_ENV === 'production' && !process.env.CRON_SECRET) {
      return res.status(503).json({ success: false, error: 'Cron authentication is not configured.' });
    }
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized cron request.' });
    }
    await checkAndSendRoomEmails();
    res.json({
      success: true,
      message: 'Room credentials check executed successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Cron Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mount Routes
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Free Fire Arena API Backend',
    endpoints: {
      health: '/api/health',
      tournaments: '/api/tournaments',
      registrations: '/api/registrations',
      admin: '/api/admin',
    },
  });
});

// 404 Route Handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found.',
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : message,
  });
});

// Server Initialization
async function startServer() {
  try {
    console.log('====================================================');
    console.log('       FREE FIRE ARENA ESPORTS BACKEND SERVER        ');
    console.log('====================================================');

    getSessionSecret();
    // Initialize Database and Run Schema Migrations
    await initDb();
    await runMigrations();

    // Start Server-Side Scheduler
    startRoomScheduler();

    app.listen(PORT, () => {
      console.log(`[Server] Express API server running on http://localhost:${PORT}`);
      console.log(`[Server] Public Tournaments API: http://localhost:${PORT}/api/tournaments`);
      console.log(`[Server] Admin API: http://localhost:${PORT}/api/admin`);
      console.log('====================================================');
    });
  } catch (error) {
    console.error('[Server Startup Fatal Error]', error);
    process.exit(1);
  }
}

// Only start the standalone listener if run directly (not imported as a serverless module)
if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
