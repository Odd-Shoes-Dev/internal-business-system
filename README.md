# BlueOx Business Platform

A multi-company business management system: double-entry accounting, invoicing, purchasing,
inventory, a point-of-sale till (with restaurant mode), payroll, fixed assets and
industry modules. Each company's data is kept separate, and companies switch on the modules they pay for.

## Stack

- **Next.js 15** (App Router, React 18, TypeScript, Tailwind)
- **PostgreSQL on Neon**, queried with raw SQL through `src/lib/provider` (`APP_DB_PROVIDER=neon`)
- **Own login sessions** (`app_users` / `app_sessions`, cookie `blueox_session`); no external auth
- **Whop** for subscriptions, **Resend** for email, **ImageKit** for images,
  **WhatsApp Cloud API** for order confirmations (one WhatsApp Business account per company)
- **Vitest** for unit and integration tests

## Getting started

```bash
npm install
cp .env.example .env.local      # fill in the values below
npm run migrate:local           # creates / updates the database schema
npm run dev                     # http://localhost:3000
```

Sign up at `/signup` (set `NEXT_PUBLIC_SIGNUPS_ENABLED=true`) to create the first company. In
development, `npm run dev:enable-modules` switches on every module for every company (it refuses
to run with `NODE_ENV=production`).

### Environment

| Variable | What it is |
|---|---|
| `NEON_DATABASE_URL` | Postgres connection string (required) |
| `APP_DB_PROVIDER` | `neon` (the only provider today) |
| `APP_ENCRYPTION_KEY` | 32 bytes, base64; encrypts per-company secrets such as WhatsApp tokens. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated emails of the people who run the platform (admin pages, legacy plans). A company admin is *not* a platform admin. |
| `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL` | Public URL of the app |
| `NEXT_PUBLIC_SIGNUPS_ENABLED` | `true` to allow new companies to sign up |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Email |
| `WHOP_API_KEY`, `WHOP_COMPANY_ID`, `NEXT_PUBLIC_WHOP_COMPANY_ID`, `WHOP_SETUP_SECRET` | Billing |
| `IMAGEKIT_*` | Image uploads |
| `CRON_SECRET` | Protects `/api/cron/*` |
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_DISPLAY_PHONE`, `NEXT_PUBLIC_WHATSAPP_LINK` | Support contact shown in the app |

Never commit real values: `.env.example` should only ever hold placeholders.

### Slow connections to the database

The database is in AWS us-east-2 (Ohio). From far away each query takes about 0.3 s, and
Node's default of 250 ms per address made connections fail with `ETIMEDOUT`; the app and the
migrate script now allow 3 s per address. For fast local development, run a local Postgres (or a
Neon branch in Frankfurt/London) and point `NEON_DATABASE_URL` at it.

## Database migrations

SQL files in `neon-migrations/`, applied in number order. `scripts/migrate.mjs` records what
it applied in `schema_migrations` and runs each new file in its own transaction.

```bash
npm run migrate:local    # local: reads .env.local
npm run migrate          # CI / production: NEON_DATABASE_URL already in the environment
npm run migrate:stamp    # mark all files as applied without running them (existing databases)
```

`npm run build` runs the migrations afterwards (`postbuild`), so a deploy migrates the database it
points at. Add a change as a new numbered file; never edit one that has been applied.

## Tests

```bash
npm test                    # unit tests (no database)
npm run test:integration    # real API routes against NEON_DATABASE_URL
```

Integration tests run every route call inside one transaction that is **always rolled back**,
and apply pending migrations inside it, so nothing is saved. Still, point them at a development
database, never production. They need at least one company with an owner or admin user.

## Modules

| Module | What it covers |
|---|---|
| Core (always on) | Customers, vendors, invoices, quotations, receipts, bills, expenses, bank & cash, general ledger, financial reports, Sales page |
| Inventory & Assets | Products & services, variants, receiving stock (with or without a purchase order), batches & expiry, stock adjustments with approval, stock takes, requisitions, promotions, labels, fixed assets |
| Point of Sale | Full-screen till, shifts, customers & credit sales, discounts, loyalty points, returns, held orders, WhatsApp receipts, restaurant mode (tables, kitchen tickets, split bills) |
| Payroll | Employees, payroll periods, payslips (PAYE, NSSF) |
| Tours, Fleet, Hotels, Cafe | Industry modules for tour operators, hotels and cafes |

Roles per company: owner/admin, accountant, operations, sales, guide, viewer
(see `docs/user-roles-and-permissions.md`).

## How the money and stock fit together

- **Stock enters only through receiving.** Accepting a goods receipt adds batches and posts
  Dr Inventory (1200) / Cr Goods Received Not Invoiced (2150). The supplier's bill for those goods
  debits 2150 and credits Accounts Payable; it does not add stock again.
- **Stock leaves earliest-expiry first, then oldest first (FIFO).** Each sale, return, adjustment and
  stock take goes through `src/lib/inventory/stock.ts`.
- **Every sale posts to the ledger** (`src/lib/accounting/provider-accounting.ts`): receivable,
  revenue net of tax, VAT payable (2200), cost of goods sold (5000) against inventory, and one entry
  per payment (cash 1000, card/bank 1020, mobile money 1040).
- **Stock adjustments** post losses to Inventory Write-offs (5300); opening stock posts to Opening
  Balance Equity (3050).
- A deferred trigger refuses any journal entry whose debits and credits differ.

## Plans and billing

Trials, then paid plans through Whop. A trial that ends without payment makes the company
read-only (`src/lib/subscription-access.ts`). Clients moved over from the old inventoryMgt system
are on the **legacy plan**: a fixed monthly fee invoiced by us, chosen modules, never locked.
Platform admins assign it on `/dashboard/admin/subscriptions`.

## Project layout

```
src/app/api/          API routes (each checks the session and company access)
src/app/dashboard/    Back-office pages
src/app/pos/          The till (full screen)
src/lib/accounting/   Journal entries, costing
src/lib/inventory/    Stock, receiving, adjustments
src/lib/pos/          Till pricing, promotions, loyalty, tables, returns
src/lib/provider/     Database provider and route guards
neon-migrations/      Schema (SQL)
tests/integration/    Route tests against a real database (rolled back)
docs/                 Design notes, API docs, contracts
```

## Further reading

- `docs/FIREBASE_VS_NEON.md`: database options and the recommendation
- `docs/user-roles-and-permissions.md`: roles and what each can see
- `docs/api/`: external API for integrations
- `docs/POS_PLAN.md`: how the till was designed
