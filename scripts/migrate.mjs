/**
 * Auto-migration runner for Neon PostgreSQL.
 *
 * Reads all .sql files from neon-migrations/ in numeric order,
 * tracks which ones have been applied in a schema_migrations table,
 * and applies any new ones in sequence.
 *
 * Usage:
 *   node scripts/migrate.mjs
 *
 * Vercel build command:
 *   next build && node scripts/migrate.mjs
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'neon-migrations');

const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) {
  console.error('❌ NEON_DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    'SELECT filename FROM schema_migrations ORDER BY filename ASC'
  );
  return new Set(result.rows.map((r) => r.filename));
}

async function getMigrationFiles() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && /^\d+_/.test(f))
    .sort();
  return files;
}

async function stampMigrations() {
  // Marks all existing migration files as applied WITHOUT running the SQL.
  // Use this once on a DB that already has the schema applied manually.
  const client = await pool.connect();
  try {
    console.log('🔖 Stamping existing migrations as applied...');
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = await getMigrationFiles();
    const unstamped = files.filter((f) => !applied.has(f));

    if (unstamped.length === 0) {
      console.log('✅ All migrations already stamped.');
      return;
    }

    await client.query('BEGIN');
    for (const filename of unstamped) {
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
        [filename]
      );
      console.log(`   ✓ Stamped: ${filename}`);
    }
    await client.query('COMMIT');
    console.log(`\n✅ Stamped ${unstamped.length} migration(s). Future migrations will run normally.`);
  } finally {
    client.release();
    await pool.end();
  }
}

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('🔄 Running database migrations...');

    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = await getMigrationFiles();

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('✅ Database is up to date. No migrations to run.');
      return;
    }

    console.log(`📋 Found ${pending.length} pending migration(s):`);
    pending.forEach((f) => console.log(`   - ${f}`));

    for (const filename of pending) {
      const filepath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filepath, 'utf8');

      console.log(`\n⏳ Applying: ${filename}`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`✅ Applied: ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed on: ${filename}`);
        console.error(`   Error: ${err.message}`);
        console.error('   Rolling back. Stopping migration run.');
        process.exit(1);
      }
    }

    console.log(`\n✅ All migrations applied successfully.`);
  } finally {
    client.release();
    await pool.end();
  }
}

const isStamp = process.argv.includes('--stamp');
const runner = isStamp ? stampMigrations : runMigrations;

runner().catch((err) => {
  console.error('❌ Migration runner crashed:', err.message);
  process.exit(1);
});
