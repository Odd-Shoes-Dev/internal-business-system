# Neon Migration Baseline - ESSENTIAL MIGRATIONS TO KEEP

## Quick Summary

**Total migrations analyzed:** 74  
**Core-essential migrations for baseline:** 23  
**Optional SaaS billing:** +13 (if building multi-tenant platform)  
**Total recommended:** 23-36 migrations

---

## Single-Tenant Baseline (23 Migrations) - KEEP THESE

Run in this exact order. These provide complete ERP functionality without Breco-specific or legacy transformational code.

| # | Filename | Purpose | Critical |
|---|----------|---------|----------|
| 1 | **001_initial_schema.sql** | Chart of accounts (assets, revenue, expenses), GL structure, bank accounts, customers, vendors, invoices, bills, expenses, fixed assets, employees, payroll | ✅ CRITICAL |
| 2 | **004_functions.sql** | Numbering generators (invoice, bill, journal), balance calculation functions | ✅ CRITICAL |
| 3 | **005_user_profile_trigger.sql** | Auto-create user_profiles on auth signup | ✅ CRITICAL |
| 4 | **007_scheduled_reports.sql** | Automated report scheduling infrastructure | ✅ YES |
| 5 | **008_add_customer_balance.sql** | Customer receivables tracking | ✅ YES |
| 6 | **011_add_expenses_bank_account.sql** | Link expenses to bank accounts | ✅ YES |
| 7 | **012_add_vendor_balance.sql** | Vendor payables tracking | ✅ YES |
| 8 | **015_add_document_types.sql** | Multi-document support (invoice, receipt, quotation, proforma) | ✅ YES |
| 9 | **016_add_multiple_emails.sql** | Multiple contact emails per customer | ✅ YES |
| 10 | **017_add_multi_currency_support.sql** | Multi-currency accounting with exchange rates | ✅ YES |
| 11 | **018_update_existing_currencies.sql** | Seed currency defaults | ✅ YES |
| 12 | **019_add_currency_to_assets.sql** | Asset currency tracking | ✅ YES |
| 13 | **024_fix_employee_payroll_schema.sql** | Employment status, payroll enums | ✅ YES |
| 14 | **025_auto_balance_updates.sql** | Automatic balance calculations on transactions | ✅ CRITICAL |
| 15 | **027_expense_approval_workflow.sql** | Expense approval tracking (approved_by, rejected_by) | ✅ YES |
| 16 | **028_bank_reconciliation_system.sql** | Bank statement matching and reconciliation | ✅ YES |
| 17 | **029_depreciation_posting_system.sql** | Fixed asset depreciation automation (GAAP required) | ✅ YES |
| 18 | **032_inventory_assets_enhancements.sql** | Multi-location inventory support | ✅ YES |
| 19 | **033_add_reference_invoice_number.sql** | Receipt-to-invoice linking | ✅ YES |
| 20 | **037_add_sales_role.sql** | Sales team role enum | ✅ YES |
| 21 | **040_fix_customer_vendor_generators.sql** | Customer/vendor number generators | ✅ YES |
| 22 | **049_fix_user_signup_trigger.sql** | Fix signup trigger default role | ✅ YES |
| 23 | **065_activity_logs.sql** | Audit trail (adapt RLS policies for native PostgreSQL) | ✅ YES |

---

## Multi-Tenant SaaS Baseline (Add 13 More)

If building a SaaS platform, add these AFTER the 23 core migrations above:

| + | Filename | Purpose |
|---|----------|---------|
| 24 | **042_multi_tenant_core.sql** | Companies entity (redesign for native PostgreSQL, not Supabase RLS) |
| 25 | **006_add_viewer_enum.sql** | Viewer role for granular permissions |
| 26 | **055_add_trial_modules.sql** | Trial and subscription tracking |
| 27 | **056_create_subscriptions_table.sql** | Core subscription management |
| 28 | **057_create_subscription_modules_table.sql** | Module activation per company |
| 29 | **058_create_billing_history_table.sql** | Payment audit trail |
| 30 | **059_create_user_invitations_table.sql** | Team member invitations |
| 31 | **060_create_email_notifications_table.sql** | Email notification tracking |
| 32 | **061_create_user_tracking_triggers.sql** | User count enforcement and limits |
| 33 | **062_api_integrations_system.sql** | Third-party API integration framework |
| 34 | **063_email_logs.sql** | Transactional email audit trail |
| 35 | **064_grace_period.sql** | Subscription cancellation grace periods |
| 36 | **066_rate_limiting_system.sql** | API rate limiting |
| 37 | **071_add_module_quotas.sql** | Module quota enforcement by plan tier |

---

## MIGRATIONS TO EXPLICITLY SKIP (Do Not Include)

### Breco Safaris Specific (15 migrations):
❌ 003, 020, 021, 022, 023, 026, 030, 031, 034, 035, 036, 038, 041, 048

**Reason:** Hardcoded Breco company data, tour/safari/hotel/cafe business logic, vehicle fleet management specific to their business model.

### Legacy Multi-Tenancy Transformations (18 migrations):
❌ 002, 009, 010, 014, 043, 044, 045, 046, 051, 052, 053, 054, 067, 068, 069, 070, 072, 073, 074

**Reason:** These layer multi-tenancy on top of a single-tenant schema using Supabase Row Level Security. For Neon, rebuild multi-tenancy natively from the start (standard PostgreSQL patterns, not Supabase-specific).

### Supabase Storage Only (5 migrations):
❌ 013, 047, 054, 048 (partially), 023 (partially)

**Reason:** Supabase storage bucket setup. For Neon, use S3 with signed URLs in application layer instead.

### Other Transformations (3 migrations):
❌ 050 - Multi-tenant signup trigger (creates default company, too specific)  
❌ 072 - Re-updated signup trigger (part of transformation sequence)  
❌ 073 - Migrate to subscription modules (one-time data migration, not repeatable)

---

## Key Principles for Neon Baseline

### ✅ INCLUDE:
- Core accounting schema and functions
- Financial document management (invoices, bills, expenses)
- Chart of accounts with standard business hierarchies
- Multi-currency and audit capabilities
- SaaS subscription features (if building platform)

### ❌ EXCLUDE:
- Breco Safaris company-specific configuration
- Supabase Row Level Security policies (use native PostgreSQL)
- Legacy data transformations (migrate_existing_data, etc.)
- Supabase storage buckets (use cloud storage service)
- Tour/hotel/cafe/fleet business logic (industry-specific)

### 🔧 REDESIGN FOR NEON:
- Multi-tenancy: Implement as native PostgreSQL (not RLS policies)
- Storage: S3 buckets + signed URL generation in app layer
- Auth: Supabase Auth tokens compatible with PostgreSQL session vars
- Companies: First-class entity in initial schema (not added later via ALTER TABLE)

---

## Notes for Migration

1. **Sequence matters:** Run migrations in numeric order; do not skip intermediate migrations even if you don't use them.
2. **Seed data:** Replace 003_seed_data with generic chart of accounts (not Breco-specific).
3. **Customizations:** Built-in flexibility for:
   - Multiple reporting schedules (migration 007)
   - Document types (migration 015)
   - Multi-currency (migration 017)
   - Approval workflows (migration 027)
4. **No data footprint:** Clean schema ready for new customers; zero Breco Safaris artifacts.

