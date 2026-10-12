/**
 * Development helper: turns on every paid module for a company (or all companies) so the
 * whole app is visible without going through billing. Modules added this way cost nothing.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dev-enable-all-modules.mjs                 # all companies
 *   node --env-file=.env.local scripts/dev-enable-all-modules.mjs <company-id>    # one company
 *
 * Refuses to run when NODE_ENV=production.
 */

import net from 'net';
import pg from 'pg';

// Keep in step with the module_id CHECK constraint on subscription_modules
const MODULES = ['tours', 'fleet', 'hotels', 'cafe', 'security', 'inventory', 'payroll', 'retail', 'pos'];

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run with NODE_ENV=production');
  process.exit(1);
}
if (!process.env.NEON_DATABASE_URL) {
  console.error('NEON_DATABASE_URL is not set (run with --env-file=.env.local)');
  process.exit(1);
}

// See src/lib/db/neon.ts: give each address 3s instead of Node's 250ms default
net.setDefaultAutoSelectFamilyAttemptTimeout(3000);

const client = new pg.Client({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
const companyId = process.argv[2] || null;

try {
  await client.connect();
  const companies = await client.query(
    'SELECT id, name FROM companies WHERE $1::uuid IS NULL OR id = $1::uuid ORDER BY name',
    [companyId]
  );
  if (!companies.rowCount) {
    console.error(companyId ? `No company with id ${companyId}` : 'No companies found');
    process.exit(1);
  }

  for (const company of companies.rows) {
    const added = await client.query(
      `INSERT INTO subscription_modules (company_id, module_id, monthly_price, setup_fee, currency, is_active, is_included)
       SELECT $1, m, 0, 0, 'USD', true, true
       FROM unnest($2::text[]) AS m
       WHERE NOT EXISTS (
         SELECT 1 FROM subscription_modules sm WHERE sm.company_id = $1 AND sm.module_id = m AND sm.is_active
       )
       RETURNING module_id`,
      [company.id, MODULES]
    );
    const list = added.rows.map((r) => r.module_id).join(', ');
    console.log(`${company.name}: ${added.rowCount ? `enabled ${list}` : 'all modules already on'}`);
  }
  console.log('\nReload the app (or switch company) to see the new menus.');
} finally {
  await client.end();
}
