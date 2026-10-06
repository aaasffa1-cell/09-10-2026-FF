const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let pool = null;
let isInMemory = false;
let memDb = null;
let memAdapter = null;

async function initDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && databaseUrl.trim() !== '') {
    try {
      const useSsl = process.env.DB_SSL === 'false'
        ? false
        : (process.env.DB_SSL === 'true' ||
           databaseUrl.includes('sslmode=require') ||
           databaseUrl.includes('neon.tech') ||
           databaseUrl.includes('supabase.co') ||
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
      console.warn(`[DB] Failed to connect to PostgreSQL at ${databaseUrl}: ${err.message}`);
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

  // Use pg-mem for local development Postgres engine
  try {
    const { newDb } = require('pg-mem');
    memDb = newDb();
    
    // Register custom functions if needed (e.g. current_timestamp)
    memAdapter = memDb.adapters.createPg();
    pool = new memAdapter.Pool();
    isInMemory = true;
    console.log('[DB] Initialized PostgreSQL engine (in-memory mode for development).');
  } catch (memErr) {
    console.error('[DB] Failed to initialize in-memory database:', memErr);
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
    if (process.env.DEBUG_SQL === 'true') {
      console.log('[SQL]', { text, params, duration: `${duration}ms`, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('[SQL Error]', { text, params, error: error.message });
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
  console.log('[DB] Running schema migrations...');
  
  if (isInMemory) {
    // pg-mem executes schema directly
    memDb.public.none(schemaSql);
  } else {
    await pool.query(schemaSql);
  }
  console.log('[DB] Schema migrations completed.');

  // Run seed data if needed
  try {
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    console.log('[DB] Seeding initial data...');
    if (isInMemory) {
      memDb.public.none(seedSql);
    } else {
      await pool.query(seedSql);
    }
    console.log('[DB] Seed data populated successfully.');
  } catch (seedErr) {
    console.warn('[DB] Seed note:', seedErr.message);
  }
}

module.exports = {
  initDb,
  query,
  getClient,
  runMigrations,
  getPool: () => pool,
  isInMemory: () => isInMemory,
};
