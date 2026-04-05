# Neon Database Migrations - Canonical Baseline

This `neon-migrations/` folder contains the production-ready database schema for the BlueOx multi-tenant SaaS platform on Neon (PostgreSQL).

## Overview

**Total Migrations:** 37 (+ 1 compat layer)  
**Database:** Neon PostgreSQL  
**Architecture:** Multi-tenant with Supabase Auth integration  
**Status:** Ready for production use

## Migration Strategy

These migrations represent a **clean extraction** of the core SaaS application schema, with:
- ✅ All Breco Safaris client-specific logic **removed**
- ✅ All legacy Supabase-only RLS policies **replaced** with native PostgreSQL
- ✅ All core accounting, invoicing, subscription, and module features **included**
- ✅ Supabase storage bucket setup **removed** (use S3 instead)

## Migration Files Included

### Compatibility Layer
- **000_neon_compat.sql** - Auth stub functions (`auth.uid()`, `auth.role()`) to support migrations written for Supabase

### Core ERP (23 migrations)
Core accounting and business operations:
- **001_initial_schema.sql** - Chart of accounts, GL, invoicing, customers, vendors, inventory, payroll
- **004_functions.sql** - Numbering generators, balance calculations
- **005_user_profile_trigger.sql** - Auto-create user profiles on signup
- **007_scheduled_reports.sql** - Report scheduling
- **008, 011, 012** - Customer/vendor balance tracking
- **015, 016** - Multi-document types, multiple emails
- **017-019** - Multi-currency support
- **024, 025** - Payroll, auto-balance updates
- **027-029** - Expense approval, bank reconciliation, depreciation
- **032, 033** - Multi-location inventory, invoice linking
- **037, 040** - Sales role, number generators
- **049** - Signup trigger
- **065** - Activity logs

### Multi-Tenant SaaS (13 migrations)
Subscription, billing, and platform features:
- **006** - Viewer role
- **042** - Multi-tenant companies entity
- **055-071** - Subscriptions, trials, modules, billing history, user invitations, email notifications, API integrations, rate limiting, module quotas

## How to Run Migrations

### First Time Setup (Clean Database)
```powershell
# 1. Open PowerShell in project root
Set-Location "C:\Users\HP\Desktop\internal-business-system"

# 2. Reset database (dev/staging only!)
# In Neon SQL Editor:
# DROP SCHEMA public CASCADE;
# CREATE SCHEMA public;

# 3. Run migrations
.\run-neon-migrations.ps1
```

### Expected Output
```
Starting Neon migrations from neon-migrations...
---
Compatibility objects ready (auth schema + auth.uid()).
---
Running: 000_neon_compat.sql
  OK Success
Running: 001_initial_schema.sql
  OK Success
... (37 more migrations)
---
Migration Summary:
  Total: 38
  Success: 38
  Failed: 0
  Skipped: 0

✓ All selected migrations completed successfully!
```

### Continue After Failure
If a migration fails:
1. Review the error in the output
2. Fix the migration file in `neon-migrations/` if needed
3. Rerun: `.\run-neon-migrations.ps1`

The script stops at first failure to make debugging easier.

## What Changed from Supabase Migrations

### ❌ Removed (Not in Neon baseline)
- **Breco Safaris** - Hardcoded company data, tour/safari/hotel/cafe/fleet operations
- **Legacy RLS** - Supabase Row Level Security policies (complex, layered, not repeatable in baseline)
- **Storage Buckets** - Supabase storage setup (use S3 with signed URLs in app)
- **One-time Transforms** - Data migrations that assumed changing single-tenant schema

### ✅ Added for Neon
- **000_neon_compat.sql** - Compat layer for auth functions
- **Native PostgreSQL** - Standard GRANT/REVOKE instead of RLS policies
- **Clean Multi-tenancy** - First-class `companies` entity from day 1

## Multi-Tenancy in Neon

Unlike the Supabase version (which layered multi-tenancy on single-tenant schema with 18+ transformation migrations):

**Neon baseline is natively multi-tenant:**
1. `companies` table created in migration 042
2. All tables include `company_id` from the start
3. Data isolation via **application-level queries** (simpler, faster, more reliable)
4. Optional: RLS policies can be re-added at app layer if needed

Example query (application enforces company_id):
```sql
SELECT * FROM invoices 
WHERE company_id = current_setting('app.current_company_id')::uuid;
```

## Authentication Integration

**Auth System:** Supabase Auth (JWT-based)  
**Database:** Neon PostgreSQL  
**Connection:** JWT claims → PostgreSQL session variables

Application middleware sets:
```sql
SET request.jwt.claim.sub = '...user-id...';
SET request.jwt.claim.user_role = 'admin|accountant|...';
SET app.current_company_id = '...company-id...';
```

Then compat functions (`auth.uid()`, `auth.role()`) read these for queries.

## Maintenance & Updates

### Adding New Migrations
1. Create file: `neon-migrations/XXX_description.sql`
2. Run: `.\run-neon-migrations.ps1`

### Updating Existing Migrations
- **Do NOT modify** migrating files (001-071)
- Create new migration for schema changes
- Document reason in migration file header

### Deprecating Old Schema
- Add migration to: `DROP TABLE/COLUMN/INDEX ...` if replacing
- Schedule cleanup in future release notes

## Troubleshooting

### psql not found
- Install PostgreSQL client tools
- Close and reopen PowerShell

### Migration fails with "relation already exists"
- Clean database: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
- Confirm auth compat layer ran first (000_neon_compat.sql)

### auth.uid() or auth.role() not found
- Confirm 000_neon_compat.sql ran successfully
- Check that compat functions exist: `\df auth.*` in psql

## References

- Neon docs: https://neon.tech/docs/
- Migration analysis: [MIGRATION_ANALYSIS.md](MIGRATION_ANALYSIS.md)
- Baseline summary: [NEON_BASELINE_MIGRATIONS.md](NEON_BASELINE_MIGRATIONS.md)
- PowerShell runner: [../run-neon-migrations.ps1](../run-neon-migrations.ps1)

---

**Last Updated:** April 4, 2026  
**Version:** Neon Multi-Tenant SaaS Baseline (37 migrations)
