async function migrateSchemaCompatibility(client) {
  await client.query(`
    ALTER TABLE tournaments
      ADD COLUMN IF NOT EXISTS registration_open BOOLEAN NOT NULL DEFAULT TRUE;
    CREATE INDEX IF NOT EXISTS idx_tournaments_date
      ON tournaments(date, registration_open);
  `);
}

module.exports = { migrateSchemaCompatibility };
