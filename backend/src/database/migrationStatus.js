require('dotenv').config();
const { initDb, getMigrationStatus, getPool } = require('./db');

async function main() {
  try {
    await initDb();
    const migrations = await getMigrationStatus();
    if (!migrations.length) {
      console.log('[MigrationStatus] No recorded migrations found.');
      return;
    }
    for (const migration of migrations) {
      console.log(`[MigrationStatus] ${migration.version} applied at ${migration.applied_at}`);
    }
  } catch (error) {
    console.error('[MigrationStatus] Unable to inspect migration state:', error.message);
    process.exitCode = 1;
  } finally {
    await getPool()?.end().catch(() => {});
  }
}

main();
