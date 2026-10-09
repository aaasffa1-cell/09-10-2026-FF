const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { migratePaymentSchema, migrateManualUpiReview } = require('./paymentMigration');
const { migrateCustomerAuthAndSquads } = require('./customerAuthAndSquadsMigration');

let pool = null;
let isInMemory = false;
let memDb = null;
let memAdapter = null;

function sanitizeDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  let cleaned = rawUrl.trim().replace(/[\r\n\s]+/g, '');

  // If the URL has an unencoded '#' in the user:pass segment before '@'
  const atIndex = cleaned.lastIndexOf('@');
  if (atIndex > -1) {
    const prefix = cleaned.substring(0, atIndex);
    const suffix = cleaned.substring(atIndex);
    const schemeIndex = prefix.indexOf('://');
    if (schemeIndex > -1) {
      const scheme = prefix.substring(0, schemeIndex + 3);
      const auth = prefix.substring(schemeIndex + 3);
      const safeAuth = auth.replace(/#/g, '%23');
      cleaned = scheme + safeAuth + suffix;
    }
  }
  return cleaned;
}

async function initDb() {
  const rawUrl = process.env.DATABASE_URL;
  const databaseUrl = sanitizeDatabaseUrl(rawUrl);

  if (!databaseUrl && process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required for production PostgreSQL storage.');
  }

  if (databaseUrl && databaseUrl.trim() !== '') {
    try {
      const useSsl = process.env.DB_SSL === 'false'
        ? false
        : (process.env.DB_SSL === 'true' ||
           databaseUrl.includes('sslmode=require') ||
           databaseUrl.includes('neon.tech') ||
           databaseUrl.includes('supabase.co') ||
           databaseUrl.includes('supabase.com') ||
           databaseUrl.includes('render.com') ||
           databaseUrl.includes('railway.app') ||
           process.env.NODE_ENV === 'production');

      pool = new Pool({
        connectionString: databaseUrl,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
      });

      // Test connection
      const client = await pool.connect();
      client.release();
      console.log('[DB] Connected to PostgreSQL database successfully.');
      return;
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        const failedPool = pool;
        pool = null;
        if (failedPool) await failedPool.end().catch(() => {});
        throw new Error('Unable to connect to the configured production PostgreSQL database.');
      }
      console.warn(`[DB] Failed to connect to PostgreSQL: ${err.message}`);
      console.warn('[DB] Falling back to PostgreSQL-compatible engine for local development.');
    }
  } else {
    // Check if local postgres on default port works
    try {
      pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432', 10),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'freefire_arena',
      });
      const client = await pool.connect();
      client.release();
      console.log('[DB] Connected to local PostgreSQL database.');
      return;
    } catch (err) {
      // Local Postgres not running or not configured
    }
  }

  // Use pg-mem for local development Postgres engine fallback
  try {
    const { newDb } = require('pg-mem');
    memDb = newDb();
    memAdapter = memDb.adapters.createPg();
    pool = new memAdapter.Pool();
    isInMemory = true;
    console.log('[DB] Initialized PostgreSQL engine (in-memory mode for development).');
  } catch (memErr) {
    console.error('[DB] Failed to initialize database engine:', memErr);
    throw memErr;
  }
}

async function query(text, params) {
  if (!pool) {
    await initDb();
  }
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true' && process.env.NODE_ENV !== 'production') {
      console.log('[SQL]', { text, duration: `${duration}ms`, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('[SQL Error]', { text, error: error.message });
    throw error;
  }
}

async function getClient() {
  if (!pool) {
    await initDb();
  }
  return pool.connect();
}

async function runMigrations() {
  if (!pool) {
    await initDb();
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const seedPath = path.join(__dirname, 'seed.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const seedSql = fs.readFileSync(seedPath, 'utf8');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    if (!isInMemory) {
      await client.query('SELECT pg_advisory_xact_lock(4815162342)');
    }
    const migrationTable = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name = 'schema_migrations'`
    );
    if (!migrationTable.rows.length) {
      await client.query(`
        CREATE TABLE schema_migrations (
          version VARCHAR(100) PRIMARY KEY,
          applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    const appliedResult = await client.query(
      `SELECT version FROM schema_migrations`
    );
    const appliedVersions = new Set(appliedResult.rows.map((row) => row.version));
    console.log('[DB] Applying PostgreSQL schema and payment migrations...');
    if (!appliedVersions.has('0001_baseline')) {
      await client.query(schemaSql);
      await client.query(
        `INSERT INTO schema_migrations (version) VALUES ('0001_baseline')`
      );
    }
    if (!appliedVersions.has('0002_payment_lifecycle')) {
      await migratePaymentSchema(client, { transaction: false });
      await client.query(
        `INSERT INTO schema_migrations (version) VALUES ('0002_payment_lifecycle')`
      );
    }
    if (!appliedVersions.has('0003_manual_upi_review')) {
      await migrateManualUpiReview(client);
      await client.query(
        `INSERT INTO schema_migrations (version) VALUES ('0003_manual_upi_review')`
      );
    }
    if (!appliedVersions.has('0004_customer_auth_and_squads')) {
      await migrateCustomerAuthAndSquads(client);
      await client.query(
        `INSERT INTO schema_migrations (version) VALUES ('0004_customer_auth_and_squads')`
      );
    }

    console.log('[DB] Applying idempotent seed data...');
    await client.query(seedSql);

    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD.trim(), 10);
      await client.query(
        `INSERT INTO admins (email, password_hash)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
        [adminEmail, passwordHash]
      );
    }

    await client.query('COMMIT');
    console.log('[DB] Schema migrations and seed completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[DB] Migration transaction failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function getMigrationStatus() {
  if (!pool) {
    await initDb();
  }
  const tableResult = await query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = 'schema_migrations'`
  );
  if (!tableResult.rows.length) return [];
  const result = await query(
    `SELECT version, applied_at FROM schema_migrations ORDER BY version`
  );
  return result.rows;
}

module.exports = {
  initDb,
  query,
  getClient,
  runMigrations,
  getMigrationStatus,
  getPool: () => pool,
  isInMemory: () => isInMemory,
  sanitizeDatabaseUrl,
};
