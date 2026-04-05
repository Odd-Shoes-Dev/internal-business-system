# Supabase Migration Analysis for Neon Baseline

## Migration Categorization Report

| # | Filename | Category | Key Tables/Types Created | Reason |
|---|----------|----------|--------------------------|--------|
| 001 | initial_schema.sql | CORE-ESSENTIAL | ENUMs (account_type, journal_status, payment_method, etc.), company_settings, bank_accounts, user_profiles, accounts, fiscal_periods, journal_entries, customers, vendors, products, invoices, bills, expenses, fixed_assets, employees, payroll | Complete financial ERP schema with accounting, inventory, HR, and AR/AP foundation |
| 002 | rls_policies.sql | TRANSFORMATIONAL | N/A (policy setup) | Legacy Supabase RLS setup; multi-tenant baseline should have simpler policies |
| 003 | seed_data.sql | CLIENT-SPECIFIC | N/A (seed INSERT) | Breco Safaris chart of accounts with Uganda-specific accounts and structure |
| 004 | functions.sql | CORE-ESSENTIAL | FUNCTIONS: generate_invoice_number(), generate_bill_number(), generate_journal_number(), calculate balances, activity logging | Core numbering and calculation functions needed for ERP operations |
| 005 | user_profile_trigger.sql | CORE-ESSENTIAL | TRIGGER: on_auth_user_created | Auto-creates user_profiles when users signup; foundation for auth integration |
| 006 | add_viewer_enum.sql | SAAS-BILLING | ENUM VALUE: user_role 'viewer' | Role enum enhancement for multi-tenant permission model |
| 007 | scheduled_reports.sql | CORE-ESSENTIAL | scheduled_reports table, report_format ENUM | Standard business feature for automated report delivery |
| 008 | add_customer_balance.sql | CORE-ESSENTIAL | Column: customers.current_balance | Financial tracking field for customer receivables |
| 009 | fix_invoice_rls.sql | TRANSFORMATIONAL | N/A (RLS policy updates) | Supabase-specific RLS fix; not needed in normalized baseline |
| 010 | fix_expenses_rls.sql | TRANSFORMATIONAL | N/A (RLS policy updates) | Supabase-specific RLS fix; not needed in normalized baseline |
| 011 | add_expenses_bank_account.sql | CORE-ESSENTIAL | Columns: expenses (bank_account_id, customer_id, status) | Links expenses to banking/customer context for traceability |
| 012 | add_vendor_balance.sql | CORE-ESSENTIAL | Column: vendors.current_balance | Financial tracking for vendor payables |
| 013 | receipts_storage.sql | STORAGE/SUPABASE-ONLY | Storage bucket: receipts | Supabase storage-specific; Neon equivalent would be file storage service |
| 014 | fix_journal_update_policy.sql | TRANSFORMATIONAL | N/A (RLS policy fixes) | Supabase-specific RLS fix |
| 015 | add_document_types.sql | CORE-ESSENTIAL | ENUM: document_type (invoice, receipt, quotation, proforma), FUNCTIONS: generate_quotation_number(), generate_proforma_number(), generate_receipt_number() | Multi-document support for financial documents |
| 016 | add_multiple_emails.sql | CORE-ESSENTIAL | Columns: customers (email_2, email_3, email_4) | Standard business feature for multiple contact emails |
| 017 | add_multi_currency_support.sql | CORE-ESSENTIAL | ENUM: (used for currency codes), exchange_rates table, Columns: currency on customers, invoices, bills | Multi-currency accounting foundation for global businesses |
| 018 | update_existing_currencies.sql | CORE-ESSENTIAL | N/A (data updates) | Seed currency defaults for existing records |
| 019 | add_currency_to_assets.sql | CORE-ESSENTIAL | Column: fixed_assets.currency | Asset accounting with currency tracking |
| 020 | breco_safaris_transform.sql | CLIENT-SPECIFIC | N/A (UPDATE statements) | Hardcoded transformation of company_settings to Breco Safaris Ltd data; business-specific configuration |
| 021 | tour_images_storage.sql | CLIENT-SPECIFIC | Storage bucket: tour-images | Supabase storage for Breco Safaris tour images |
| 022 | tour_package_images.sql | CLIENT-SPECIFIC | tour_package_images table, FUNCTIONS for primary image management | Tour/safari specific feature for package presentation |
| 023 | hotel_images.sql | CLIENT-SPECIFIC | Storage bucket: hotel-images, hotel_images table | Breco hotel operations feature |
| 024 | fix_employee_payroll_schema.sql | CORE-ESSENTIAL | ENUM: employment_status, pay_frequency 'bi_weekly', payroll_status 'processing' | Core payroll schema enhancements |
| 025 | auto_balance_updates.sql | CORE-ESSENTIAL | FUNCTIONS: update_vendor_balance(), update_customer_balance(), update_bank_account_balance(), TRIGGERS for bill/invoice/payment events | Automatic balance calculation critical for accounting accuracy |
| 026 | tour_capacity_tracking.sql | CLIENT-SPECIFIC | Columns: tour_packages (max_capacity, available_slots), bookings (number_of_people), FUNCTIONS: update_tour_availability() | Breco Safaris tour slot management |
| 027 | expense_approval_workflow.sql | CORE-ESSENTIAL | Columns: expenses (approved_by, approved_at, rejected_by, rejected_date, paid_by) | Standard business expense approval tracking |
| 028 | bank_reconciliation_system.sql | CORE-ESSENTIAL | bank_reconciliations, bank_reconciliation_items tables, INDEXES | Foundation for bank statement matching (critical for cash management) |
| 029 | depreciation_posting_system.sql | CORE-ESSENTIAL | depreciation_postings, depreciation_posting_details tables, FUNCTIONS: update_asset_depreciation() | Fixed asset depreciation automation (required for GAAP) |
| 030 | tour_operations_enhancements.sql | CLIENT-SPECIFIC | booking_costs table, Columns: invoices.booking_id | Links Breco tour bookings to financial invoicing |
| 031 | fix_bookings_vehicle_fk.sql | CLIENT-SPECIFIC | CONSTRAINT: bookings.assigned_vehicle_id → vehicles.id | Breco fleet/vehicle assignment logic |
| 032 | inventory_assets_enhancements.sql | CORE-ESSENTIAL | inventory_locations, inventory_by_location tables, multi-location support | Multi-warehouse inventory tracking |
| 033 | add_reference_invoice_number.sql | CORE-ESSENTIAL | Column: invoices.reference_invoice_number | Standard receipt-to-invoice linking |
| 034 | unified_booking_system.sql | CLIENT-SPECIFIC | Columns: bookings (hotel_id, room_type, rental_type, pickup_location), CONSTRAINTS for booking validation | Breco unified booking across tours/hotels/vehicles |
| 035 | cafe_accounts_setup.sql | CLIENT-SPECIFIC | Accounts (4200-4299, 5250-5259, 6350-6359), customers 'Cafe Daily Sales' | Breco Cafe revenue/expense/COGS chart of accounts |
| 036 | seed_fiscal_periods.sql | CLIENT-SPECIFIC | fiscal_periods table data for 2025-2026 | Pre-seeded fiscal calendar for Breco (specific years) |
| 037 | add_sales_role.sql | CORE-ESSENTIAL | ENUM VALUE: user_role 'sales' | Standard role for sales team user management |
| 038 | create_admin_users.sql | CLIENT-SPECIFIC | N/A (HELPER FUNCTION and comments) | Setup function for Breco's Paul and Benon admin users |
| 040 | fix_customer_vendor_generators.sql | CORE-ESSENTIAL | FUNCTIONS: generate_customer_number(), generate_vendor_number() | Previously missing number generators needed for RLS operations |
| 041 | fix_booking_details_security.sql | SAAS-BILLING | VIEW: booking_details with SECURITY INVOKER | Booking view for secure multi-tenant data access |
| 042 | multi_tenant_core.sql | SAAS-BILLING | companies, user_companies (implied structure), FUNCTIONS: update_companies_updated_at() | Foundation of multi-tenant architecture |
| 043 | add_company_id_columns.sql | TRANSFORMATIONAL | Columns added: company_id to all major tables (accounts, journal_entries, customers, invoices, expenses, bills, etc.) | Transformation step adding multi-tenant field to existing single-tenant schema |
| 044 | migrate_existing_data.sql | TRANSFORMATIONAL | N/A (complex data migration) | One-time data migration assigning all existing data to default company; not repeatable |
| 045 | enable_rls_policies.sql | TRANSFORMATIONAL | N/A (RLS ENABLE and complex policies) | Transformation step enabling RLS after adding company_id; legacy multi-tenant migration |
| 046 | cafe_module_rls.sql | TRANSFORMATIONAL | N/A (RLS policies for cafe tables) | Cafe-specific RLS policies added separately |
| 047 | company_logos_storage.sql | STORAGE/SUPABASE-ONLY | Storage bucket: company-logos, multi-tenant RLS policies | Multi-tenant storage for company branding |
| 048 | fleet_images.sql | CLIENT-SPECIFIC | Storage bucket: fleet-images, vehicle_images table | Breco vehicle image storage |
| 049 | fix_user_signup_trigger.sql | CORE-ESSENTIAL | TRIGGER: on_auth_user_created (modified) | Fixes default role to 'sales' for signup flow |
| 050 | multi_tenant_signup_trigger.sql | TRANSFORMATIONAL | TRIGGER: on_auth_user_created (recreated for multi-tenant), FUNCTION: handle_new_user_multi_tenant() | Multi-tenant transformation: auto-creates company on signup |
| 051 | fix_user_companies_rls.sql | TRANSFORMATIONAL | N/A (RLS policies, FUNCTION: user_companies()) | Fix for RLS recursion in multi-tenant user_companies table |
| 052 | recreate_all_rls_policies.sql | TRANSFORMATIONAL | N/A (119 RLS policies recreated) | Systemic RLS policy recreation after function changes |
| 053 | disable_user_companies_rls.sql | TRANSFORMATIONAL | N/A (RLS DISABLE on user_companies) | Fix for RLS infinite loop; disables RLS on junction table |
| 054 | company_logos_storage.sql | STORAGE/SUPABASE-ONLY | Storage bucket: company-logos (duplicate with corrections) | Re-creation of logo storage with proper multi-tenant RLS |
| 055 | add_trial_modules.sql | SAAS-BILLING | Columns added to company_settings: trial_modules, trial_start_date, trial_end_date, subscription_status, plan_tier, billing_period, etc. | Trial and subscription tracking for SaaS |
| 056 | create_subscriptions_table.sql | SAAS-BILLING | subscriptions table, Stripe integration columns | Core SaaS subscription management |
| 057 | create_subscription_modules_table.sql | SAAS-BILLING | subscription_modules table, RLS policies | Tracks which industry modules are active per company |
| 058 | create_billing_history_table.sql | SAAS-BILLING | billing_history table, payment/invoice tracking | Payment audit trail for SaaS billing |
| 059 | create_user_invitations_table.sql | SAAS-BILLING | user_invitations table | Team member invitation system |
| 060 | create_email_notifications_table.sql | SAAS-BILLING | email_notifications table | Email notification tracking |
| 061 | create_user_tracking_triggers.sql | SAAS-BILLING | FUNCTIONS: update_company_user_count(), check_company_user_limit(), TRIGGERS | User count and plan limit enforcement |
| 062 | api_integrations_system.sql | SAAS-BILLING | api_integrations, integration_logs tables, rate limiting | Third-party API integration framework |
| 063 | email_logs.sql | SAAS-BILLING | email_logs table, RLS policies | Transactional email audit log |
| 064 | grace_period.sql | SAAS-BILLING | Columns: subscriptions (is_archived, cancellation_reason) | Grace period and archival support |
| 065 | activity_logs.sql | CORE-ESSENTIAL | N/A (activity_logs table already existed; just RLS policies) | Audit trail for compliance; RLS policies added |
| 066 | rate_limiting_system.sql | SAAS-BILLING | rate_limit_requests table, FUNCTIONS: cleanup_old_rate_limit_records() | API rate limiting for SaaS protection |
| 067 | add_company_id_to_settings.sql | TRANSFORMATIONAL | Column: company_settings.company_id, UNIQUE INDEX, data migration | Links legacy company_settings to multi-tenant companies |
| 068 | fix_company_settings_insert_policy.sql | TRANSFORMATIONAL | N/A (RLS INSERT policy for company_settings) | Multi-tenant RLS policy allowing company settings creation |
| 069 | add_region_to_companies.sql | TRANSFORMATIONAL | Column: companies.region with CHECK constraint, data population | Regional pricing/localization for SaaS |
| 070 | update_signup_trigger_region.sql | TRANSFORMATIONAL | FUNCTION: handle_new_user_multi_tenant() (updated), region detection logic | Signup flow enhancement for regional detection |
| 071 | add_module_quotas.sql | SAAS-BILLING | Column: company_settings.included_modules_quota, subscription_modules.is_included, FUNCTIONS: get_module_quota(), update_module_quota_on_plan_change(), TRIGGERS | Module quota enforcement (Starter=1, Professional=3, Enterprise=All) |
| 072 | fix_signup_trigger_no_modules.sql | TRANSFORMATIONAL | FUNCTION: handle_new_user_multi_tenant() (re-updated), removes company_modules inserts | Signup flow cleanup; removes old module insertion logic |
| 073 | migrate_to_subscription_modules.sql | TRANSFORMATIONAL | N/A (data migration from company_modules → subscription_modules) | One-time migration; not repeatable |
| 074 | fix_trial_end_date_sync.sql | TRANSFORMATIONAL | FUNCTION: initialize_company_settings() (corrected), one-time UPDATE | Fixes trial date misalignment between companies and company_settings tables |

---

## Migration Categories Summary

### CORE-ESSENTIAL: 34 migrations
**These are fundamental ERP/accounting schema and functions needed for any business baseline.**

Essential migrations to KEEP for Neon baseline:
- 001, 004, 005, 007, 008, 011, 012, 015, 016, 017, 018, 019, 024, 025, 027, 028, 029, 032, 033, 037, 040, 049, 065

### CLIENT-SPECIFIC: 15 migrations
**These are Breco Safaris-specific hardcoded data, tour/safari logic, and cafe operations. EXCLUDE from baseline.**

- 003, 020, 021, 022, 023, 026, 030, 031, 034, 035, 036, 038, 041, 048, 050 (creates default company during signup)

**Note:** 050 is transformational but creates a default company which is too specific. In Neon baseline, signup should NOT auto-create companies.

### TRANSFORMATIONAL: 20 migrations
**These add multi-tenancy fields and legacy RLS policies. Should be skipped in baseline - re-architect for native PostgreSQL instead of Supabase RLS.**

- 002, 009, 010, 014, 043, 044, 045, 046, 051, 052, 053, 067, 068, 069, 070, 072, 073, 074

**Why not in baseline:** These migrations layer multi-tenancy on top of a single-tenant schema (adding company_id everywhere, complex RLS). For Neon, rebuild as native multi-tenant from the start.

### SAAS-BILLING: 16 migrations
**Multi-tenant SaaS subscription/billing/module features. CONDITIONAL: include if running SaaS platform; exclude if single-tenant.**

- 006, 041, 042, 055, 056, 057, 058, 059, 060, 061, 062, 063, 064, 066, 071

### STORAGE/SUPABASE-ONLY: 5 migrations
**Supabase-specific storage buckets. For Neon baseline, use S3/cloud storage instead.**

- 013, 047, 054 (duplicate of 047), 048, 023 (part client-specific)

---

## RECOMMENDED BASELINE FOR NEON

### Option A: Single-Tenant Baseline (Core ERP only)
**Include these CORE-ESSENTIAL migrations, in order:**
1. 001 - Initial schema
2. 004 - Functions
3. 005 - User profile trigger
4. 007 - Scheduled reports
5. 008 - Customer balance
6. 011 - Expenses bank account
7. 012 - Vendor balance
8. 015 - Document types
9. 016 - Multiple emails
10. 017 - Multi-currency support
11. 018 - Update existing currencies
12. 019 - Currency to assets
13. 024 - Employee payroll schema
14. 025 - Auto balance updates
15. 027 - Expense approval workflow
16. 028 - Bank reconciliation
17. 029 - Depreciation posting
18. 032 - Inventory enhancements
19. 033 - Reference invoice number
20. 037 - Add sales role
21. 040 - Customer/vendor generators
22. 049 - Fix user signup trigger
23. 065 - Activity logs (RLS policies adapted for native PostgreSQL)

**Total: 23 migrations, pure core business logic**

### Option B: Multi-Tenant SaaS Baseline (Core ERP + Subscription)
Start with Option A (23 migrations) PLUS:
24. 042 - Multi-tenant core (companies, but designed for Neon multi-tenancy, not Supabase RLS)
25. 006 - Add viewer role enum (for fine-grained permissions)
26. 055 - Add trial modules (subscription tracking)
27. 056 - Create subscriptions table
28. 057 - Create subscription modules table
29. 058 - Create billing history table
30. 059 - Create user invitations table
31. 060 - Create email notifications table
32. 061 - Create user tracking triggers
33. 062 - API integrations system
34. 063 - Email logs
35. 064 - Grace period
36. 066 - Rate limiting system
37. 071 - Add module quotas

**Total: 36 migrations (23 core + 13 SaaS)**

**NOTE:** Skip migrations 043-045 (legacy multi-tenancy layering). Instead, re-architect:
- Add company_id as native column in initial schema (not via ALTER TABLE)
- Use standard PostgreSQL permissions/row-level scoping (native feature, not Supabase RLS)
- Design companies table as first-class entity from creation

---

## MIGRATIONS TO SKIP (Do Not Include in Baseline)

### Never Include:
- **003** - Breco Safaris seed data (use generic chart of accounts)
- **020** - Breco Safaris transform (hardcoded company data)
- **021-023, 026, 030-031, 034-036, 038, 048** - All Breco tour/hotel/fleet/cafe business logic
- **002, 009-010, 014** - Supabase-specific RLS policies (use native PostgreSQL instead)
- **043-046, 051-054, 067-070, 072-074** - Legacy multi-tenancy transformations (rebuild as native multi-tenant)
- **013, 047, 054** - Supabase storage (use S3/external storage service)

### Optional (App-Specific):
- **041** - Booking details view (specific to Breco operations)
- **050, 072, 073** - Signup trigger and module migration (rebuild as application logic, not database)
- **055, 056-061, 062-066, 071** - Only if building SaaS billing platform

---

## Implementation Recommendations

### For Single Company Baseline:
Run 23 core migrations in order. Schema will be clean, production-ready, and business-agnostic.

### For SaaS Platform Baseline:
1. Run 23 core migrations
2. Redesign migrations 042+ to use native PostgreSQL multi-tenancy patterns instead of Supabase RLS
3. Examples of native patterns:
   - `companies` table is first-class (created in initial schema)
   - Add `company_id` to all tables at creation time
   - Use PostgreSQL policies (standard SQL authorization) instead of Row Level Security
   - Implement session variables for tenant context
4. Run the redesigned SaaS-BILLING migrations (055-066, 071)

### Storage Layer:
- Replace migrations 013, 047, 048, 054 with S3 bucket configuration in infrastructure code
- Implement signed URLs in application layer instead of Supabase storage policies

