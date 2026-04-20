-- Migration 080: Drop all foreign keys referencing user_profiles
-- The app now uses app_users for authentication. All created_by / posted_by / approved_by
-- columns that referenced the legacy user_profiles table must be unlinked.
-- We drop the FK constraints but keep the UUID columns — they will hold app_users IDs.

ALTER TABLE expenses             DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;
ALTER TABLE expenses             DROP CONSTRAINT IF EXISTS expenses_approved_by_fkey;
ALTER TABLE journal_entries      DROP CONSTRAINT IF EXISTS journal_entries_created_by_fkey;
ALTER TABLE journal_entries      DROP CONSTRAINT IF EXISTS journal_entries_posted_by_fkey;
ALTER TABLE bills                DROP CONSTRAINT IF EXISTS bills_created_by_fkey;
ALTER TABLE bills                DROP CONSTRAINT IF EXISTS bills_approved_by_fkey;
ALTER TABLE invoices             DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
ALTER TABLE fixed_assets         DROP CONSTRAINT IF EXISTS fixed_assets_created_by_fkey;
ALTER TABLE purchase_orders      DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey;
ALTER TABLE cash_transactions    DROP CONSTRAINT IF EXISTS cash_transactions_created_by_fkey;
ALTER TABLE recurring_transactions DROP CONSTRAINT IF EXISTS recurring_transactions_created_by_fkey;
ALTER TABLE inventory_adjustments DROP CONSTRAINT IF EXISTS inventory_adjustments_created_by_fkey;
ALTER TABLE goods_receipts       DROP CONSTRAINT IF EXISTS goods_receipts_created_by_fkey;
ALTER TABLE payroll_periods      DROP CONSTRAINT IF EXISTS payroll_periods_created_by_fkey;
