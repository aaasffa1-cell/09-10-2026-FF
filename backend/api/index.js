const app = require('../src/server');
const { initDb, runMigrations } = require('../src/database/db');
const { getSessionSecret } = require('../src/middleware/authMiddleware');

let dbInitialized = false;

module.exports = async (req, res) => {
  if (!dbInitialized) {
    try {
      getSessionSecret();
      await initDb();
      await runMigrations().catch((migrationErr) => {
        console.warn('[Vercel Serverless] Migration notice:', migrationErr.message);
      });
      dbInitialized = true;
    } catch (err) {
      console.warn('[Vercel Serverless] DB init warning:', err.message);
    }
  }
  return app(req, res);
};
