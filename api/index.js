const app = require('../backend/src/server');
const { initDb, runMigrations } = require('../backend/src/database/db');

let dbInitialized = false;

module.exports = async (req, res) => {
  if (!dbInitialized) {
    try {
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
