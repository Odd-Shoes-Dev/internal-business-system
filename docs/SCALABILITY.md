# Scalability Assessment

## Current Architecture

**Multi-tenancy** — every query filters by `company_id`. No business ever sees
another's data. Scales correctly to 1000+ companies with proper indexes.

**Neon PostgreSQL** — serverless Postgres with auto-scaling compute and built-in
connection pooling. The database layer is not the bottleneck.

**Next.js API routes** — stateless, each request is independent. Scales
horizontally by spinning up more serverless function instances under load.

---

## Current Capacity (no changes needed)

**~50–100 active businesses** running simultaneously without any degradation.

---

## What Could Break Under 1000 Businesses

### 1. Missing Indexes (highest risk)
Every `WHERE company_id = $1` needs an index on `company_id`. Without it,
Postgres does a full table scan on every query.

- 1 business, 100 invoices → fine
- 1000 businesses, 100,000 invoices → grinds to a halt

**Fix:** Index audit across all tables. Add composite indexes on
`(company_id, created_at)`, `(company_id, status)` on high-traffic tables
(invoices, bills, expenses, payments_received, products, customers).

### 2. Dashboard Stats Query
`/api/dashboard/stats` fetches invoices, bills, expenses, and exchange rates
all at once on every page load. Heavy usage makes this a slow, hot endpoint.

**Fix:** Pre-aggregate nightly in a background job, or cache results with a
short TTL (e.g. 5 minutes). Stale-by-5-minutes dashboard stats are fine for
most businesses.

### 3. No Query Result Caching
Every request hits the database fresh. Identical queries (product lists,
customer lists, exchange rates) run repeatedly across all users.

**Fix:** Redis cache layer for frequently-read, rarely-changed data:
- Exchange rates (change once a day at most)
- Product/price list (changes infrequently)
- Company settings (changes rarely)

### 4. Company Context on Every Load
Every dashboard page calls `/api/companies/me` to get company details
(name, currency, logo, modules). At 1000 businesses this is the single
hottest endpoint in the system.

**Fix:** Cache per-user company context in Redis with a short TTL,
or use Next.js `unstable_cache` with revalidation on settings save.

### 5. Email Sending Under Load
If 1000 businesses send invoices simultaneously, the Resend queue backs up.

**Fix:** Move email sending off the request path into a background queue.
Return success to the user immediately, send email asynchronously.

### 6. No Rate Limiting
No per-company or per-IP rate limits on API routes. A misbehaving integration
or a runaway script could hammer the database.

**Fix:** Add rate limiting middleware (e.g. Upstash Redis rate limiter)
on all `/api/` routes, per `company_id`.

### 7. Heavy Operations on the Request Path
Payroll calculation, PDF generation, and report aggregation currently run
synchronously inside API route handlers. Under load these block the response.

**Fix:** Move to a background job queue (e.g. Trigger.dev, Inngest, or
a simple Postgres-backed queue). User gets a "processing" state, result
delivered when ready.

---

## Fix Priority vs Effort

| Issue | Impact | Effort | When to fix |
|---|---|---|---|
| Missing indexes | Critical | 1 day | Before 100 businesses |
| Company context caching | High | 1 day | Before 200 businesses |
| Dashboard stats caching | High | 1 day | Before 200 businesses |
| Rate limiting | Medium | 1 day | Before public launch |
| Email queue | Medium | 2 days | Before 500 businesses |
| Redis cache layer | Medium | 3 days | Before 500 businesses |
| Background job queue | Low-Medium | 1 week | Before 1000 businesses |

---

## Index Audit Checklist

Tables that need `company_id` indexes (and suggested composite indexes):

```sql
-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_status ON invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_company_date ON invoices(company_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(company_id, customer_id);

-- bills
CREATE INDEX IF NOT EXISTS idx_bills_company_id ON bills(company_id);
CREATE INDEX IF NOT EXISTS idx_bills_company_status ON bills(company_id, status);

-- expenses
CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company_date ON expenses(company_id, expense_date DESC);

-- customers
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_active ON customers(company_id, is_active);

-- products
CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- payments_received
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments_received(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_date ON payments_received(company_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments_received(company_id, customer_id);

-- employees
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);

-- journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_id ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_date ON journal_entries(company_id, entry_date DESC);

-- accounts
CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON accounts(company_id);
```

---

## Capacity Targets

| Businesses | What's needed |
|---|---|
| 1–50 | Current state — no changes |
| 50–100 | Monitor query times, nothing urgent |
| 100–200 | Index audit (1 day) |
| 200–500 | Index audit + company context cache + dashboard stats cache |
| 500–1000 | All of the above + Redis + email queue + rate limiting |
| 1000+ | All of the above + background job queue + consider read replicas |

---

## Verdict

The architecture is correct — multi-tenant, stateless API, scalable database.
Issues are **performance optimisations**, not **architectural rewrites**.

Do the index audit before approaching 100 paying businesses.
Everything else can wait until the load actually arrives.
