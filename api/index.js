const app = require('../backend/src/server');
const { initDb } = require('../backend/src/database/db');

let dbInitialized = false;

module.exports = async (req, res) => {
  if (!dbInitialized) {
    try {
      await initDb();
      dbInitialized = true;
    } catch (err) {
      console.warn('[Vercel Serverless] DB init warning:', err.message);
    }
  }
  return app(req, res);
};
