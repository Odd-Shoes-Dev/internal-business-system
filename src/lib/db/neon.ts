import { Pool } from 'pg';

const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  throw new Error('NEON_DATABASE_URL is not set');
}

let pool: Pool | undefined;

export function getNeonPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
      ssl: { rejectUnauthorized: false },
    });
  }

  return pool;
}
