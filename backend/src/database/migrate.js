require('dotenv').config();
const { initDb, runMigrations } = require('./db');

async function main() {
  try {
    console.log('[Migration] Starting database migration & setup...');
    await initDb();
    await runMigrations();
    console.log('[Migration] Migration finished successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[Migration] Failed:', error);
    process.exit(1);
  }
}

main();
