# Firebase vs Neon: database options

**Recommendation:** stay on Neon for now. If we move to Google's platform later, move to
**Cloud SQL for PostgreSQL** (optionally fronted by Firebase SQL Connect), not to Firestore.
Postgres on Google Cloud is a configuration change of about a week and keeps every feature;
Firestore is a rewrite of three to five months that weakens the accounting core.

Checked October 2026. Prices and regions change; re-check the sources at the end before deciding.

## How the app uses the database today

- Every API route talks to Postgres through `DbProvider` (`src/lib/provider/`), chosen by
  `APP_DB_PROVIDER` (only `neon` exists). The interface is `query(sql, params)` and
  `transaction(fn)`: it carries SQL, so **any second provider must speak Postgres SQL**.
- About **1,300 raw SQL queries in 244 files**, 90 SQL migration files (numbered up to 118), triggers (journal balance
  check, customer balances, purchase order column sync), sequences for document numbers,
  `FOR UPDATE` row locks for stock, and advisory locks for numbering.
- The accounting core depends on multi-row transactions: one till sale writes the invoice, its
  lines, stock lots, movements, two or more journal entries and payments, all or nothing, and a
  deferred trigger refuses an unbalanced journal at commit.
- Reports (trial balance, P&L, balance sheet, aging, sales) are `SUM ... GROUP BY` over journal
  lines and invoices.

## The options

| | **Stay on Neon** | **A. Postgres on Google Cloud** (Cloud SQL, optionally via Firebase SQL Connect) | **B. Firestore** (Firebase's document database) |
|---|---|---|---|
| Code changes | None | New provider = a second connection config; same SQL | Every route rewritten against a repository layer; reports redesigned |
| Effort | — | ~1 week (provider, migrations run, data move, testing) | ~3–5 months for one developer |
| Accounting integrity | Transactions, triggers, constraints | Same | Transactions limited per request; no triggers or constraints in the database, so balance checks move into app code |
| Reports | SQL aggregates | Same | No joins; aggregates limited; trial balance, aging and P&L need precomputed running totals kept up to date on every write |
| Closest region to Uganda | Frankfurt or London (no Africa region) | Johannesburg (`africa-south1`) | Johannesburg (`africa-south1`) |
| Pricing model | Compute hours + storage | Instance per month (from about $9.37/month) + SQL Connect operations (250,000/month free, then $0.90 per million) if used | Per document read, write and delete + storage; free daily quota of 50,000 reads and 20,000 writes |
| Cost risk | Low, predictable | Low, predictable (always-on instance) | Grows with history: a report that reads every journal line is billed per line read |
| Offline till / realtime updates | No (we would build it) | No (we would build it) | Yes, built in: the strongest reason to consider it |
| Lock-in | Standard Postgres; move anywhere with `pg_dump` | Standard Postgres; same | Firestore-only data model and query API |

### What Firestore would genuinely give us

- **Offline tills.** A shop or restaurant keeps selling when the internet drops, and syncs later.
- **Realtime screens.** Table orders, kitchen screens and stock levels update on every till at once
  (today the floor plan polls every 15 seconds).
- **A region in Africa** (shared with option A).

We can get the first two without leaving Postgres: an offline queue in the till (IndexedDB, replay
sales when back online, with server-side duplicate protection) and server-sent events or a
managed realtime service for live screens. Both are smaller projects than a database rewrite.

## "Clients on Neon should not suffer"

Both Postgres options keep this promise; the database is chosen per deployment, not per feature.

1. **Per deployment (simplest).** `APP_DB_PROVIDER=neon` (today) or `APP_DB_PROVIDER=cloudsql` with
   its own connection string. Each deployment's companies live in one database. Neon clients are
   untouched because their deployment does not change.
2. **Per company (later, if needed).** A `company_databases` table maps a company to a connection
   string, and `getNeonPool()` becomes `getPool(companyId)`. Lets one deployment serve companies in
   different databases (e.g. data residency). Needs care: auth and cross-company admin queries run
   against a "home" database.

## Moving a company to Firebase (option A)

1. Create a Cloud SQL for PostgreSQL instance in `africa-south1`; run `npm run migrate` against it.
2. Add `src/lib/provider/cloudsql-provider.ts` (the Neon provider with a different pool) and accept
   `APP_DB_PROVIDER=cloudsql`.
3. Move data:
   - **Whole database:** `pg_dump` from Neon, `pg_restore` into Cloud SQL, during a short freeze.
   - **One company at a time:** an export script copying that company's rows in dependency order
     (companies → accounts → products → ... → journal lines). About 60 child tables have no
     `company_id` of their own (line items such as `invoice_lines`, `bill_lines`,
     `payment_applications`, plus `inventory_lots`, `inventory_movements` and others), so the script
     follows foreign keys from tables that do. Write this only if per-company moves are needed.
4. Run the integration tests (`npm run test:integration`) against the new database, then switch the
   deployment's `NEON_DATABASE_URL` / provider settings.
5. Keep the Neon database read-only for a month as a fallback, then retire it.

Firebase SQL Connect (formerly Data Connect) is optional on top: it adds typed client SDKs and
per-operation billing. The app does not need it, since our API routes already query Postgres.

## Decision checklist

- [ ] Do clients need the till to work offline? If yes, plan the offline queue first; it is needed
      on any database.
- [ ] Do clients need data stored in Africa? If yes, option A (Johannesburg).
- [ ] Is latency the real problem? Measure from Kampala: Neon Frankfurt/London vs Cloud SQL Johannesburg.
- [ ] Budget: Neon plan vs an always-on Cloud SQL instance per deployment.

## Sources

- [Neon regions](https://neon.com/docs/introduction/regions)
- [Firebase SQL Connect pricing](https://firebase.google.com/docs/sql-connect/pricing?hl=en)
- [Firestore pricing (free quota, billing model)](https://firebase.google.com/docs/firestore/pricing)
- [Firestore locations (africa-south1)](https://docs.cloud.google.com/firestore/docs/locations)
- [Cloud SQL for PostgreSQL locations (africa-south1)](https://docs.cloud.google.com/sql/docs/postgres/locations)
