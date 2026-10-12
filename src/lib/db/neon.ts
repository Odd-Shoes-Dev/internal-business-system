import net from 'net';
import { Pool } from 'pg';

// Node tries each of a host's addresses (IPv6 and IPv4) for only 250ms before giving up on it.
// Over a slow or distant link to Neon every attempt is cut off and connecting fails with
// ETIMEDOUT, so give each address 3 seconds.
net.setDefaultAutoSelectFamilyAttemptTimeout(3000);

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
      // A new connection costs a TCP + TLS handshake (~2s on a slow link), so keep idle
      // connections for 5 minutes instead of pg's default 10 seconds.
      idleTimeoutMillis: 5 * 60 * 1000,
      keepAlive: true,
    });
  }

  return pool;
}
