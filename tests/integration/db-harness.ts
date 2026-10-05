import fs from 'fs';
import path from 'path';
import net from 'net';
import pg from 'pg';

// Same as src/lib/db/neon.ts: 3s per address instead of Node's 250ms
net.setDefaultAutoSelectFamilyAttemptTimeout(3000);

// One connection, one transaction for the whole test file, rolled back at the end.
// Route handlers get a provider whose transaction() is a savepoint inside it.

export const client = new pg.Client({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let savepoint = 0;

export const testDb = {
  query: (text: string, params?: any[]) => client.query(text, params) as any,
  hasCompanyAccess: async () => true,
  getSessionUser: async () => null,
  transaction: async <T>(fn: (tx: { query: (t: string, p?: any[]) => Promise<any> }) => Promise<T>): Promise<T> => {
    const name = `sp_${++savepoint}`;
    await client.query(`SAVEPOINT ${name}`);
    try {
      const result = await fn({ query: (t, p) => client.query(t, p) as any });
      await client.query(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (error) {
      await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
      throw error;
    }
  },
};

// Applies migrations from `fromNumber` on that this database has not recorded yet
export async function applyPendingMigrations(fromNumber: number) {
  const dir = path.resolve(__dirname, '../../neon-migrations');
  const applied = await client.query('SELECT filename FROM schema_migrations').catch(() => ({ rows: [] as any[] }));
  const done = new Set(applied.rows.map((r: any) => r.filename));
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f) && parseInt(f, 10) >= fromNumber).sort();
  for (const file of files) {
    if (!done.has(file)) await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
}

// Fires deferred constraint triggers (journal balance check) now instead of at commit
export async function checkDeferredConstraints() {
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
}
