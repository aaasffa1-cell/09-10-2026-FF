const app = require('../backend/src/server');
const { initDb, runMigrations } = require('../backend/src/database/db');
const { getSessionSecret } = require('../backend/src/middleware/authMiddleware');

let dbInitialized = false;
let dbInitPromise = null;

module.exports = async (req, res) => {
  if (!dbInitialized) {
    if (!dbInitPromise) {
      dbInitPromise = (async () => {
        try {
          getSessionSecret();
          await initDb();
          await runMigrations();
          dbInitialized = true;
        } catch (err) {
          console.error('[Vercel Serverless] Database initialization failed:', err.message);
          dbInitialized = false;
          throw err;
        } finally {
          if (!dbInitialized) {
            dbInitPromise = null;
          }
        }
      })();
    }

    try {
      await dbInitPromise;
    } catch (err) {
      return res.status(503).json({
        success: false,
        error: 'The service database is temporarily unavailable.',
      });
    }
  }

  return app(req, res);
};
