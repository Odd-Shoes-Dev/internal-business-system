-- Migration 043: Add company_id to ALL existing tables
-- This migration adds the company_id column to every existing table
-- IMPORTANT: Run this BEFORE enabling RLS policies

-- ============================================================================
-- ADD company_id TO CORE TABLES
-- ============================================================================

-- User profiles (keep existing table, just add company_id for reference)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Chart of Accounts (table is named 'accounts')
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Journal Entries
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Fiscal Periods
ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- ============================================================================
-- CUSTOMERS & VENDORS
-- ============================================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- ============================================================================
-- REVENUE / AR
-- ============================================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- ============================================================================
-- EXPENSES / AP
-- ============================================================================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE bill_lines ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- ============================================================================
-- BANKING
-- ============================================================================

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- ============================================================================
-- INVENTORY
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE stock_takes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- ============================================================================
-- ASSETS
-- ============================================================================

ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE depreciation_entries ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- ============================================================================
-- HR & PAYROLL
-- ============================================================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
-- ALTER TABLE payroll ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id); -- Table doesn't exist
ALTER TABLE salary_advances ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- ============================================================================
-- TOUR MODULE TABLES
-- ============================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
-- ALTER TABLE guides ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id); -- Table doesn't exist

-- ============================================================================
-- CAFE MODULE TABLES (if they exist)
-- ============================================================================

-- Only add if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'menu_categories') THEN
    ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'menu_items') THEN
    ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tables') THEN
    ALTER TABLE tables ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'orders') THEN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
  END IF;
END$$;

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
-- Critical: company_id will be in every WHERE clause, so index it!

-- Core
CREATE INDEX IF NOT EXISTS idx_user_profiles_company ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_company ON journal_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_company ON fiscal_periods(company_id);

-- Customers & Vendors
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);

-- Revenue / AR
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_date ON invoices(company_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_company_status ON invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_company ON invoice_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_received_company ON payments_received(company_id);

-- Expenses / AP
CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company_date ON expenses(company_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_company ON bills(company_id);
CREATE INDEX IF NOT EXISTS idx_bill_lines_company ON bill_lines(company_id);

-- Banking
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_company ON bank_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_company_date ON bank_transactions(company_id, transaction_date DESC);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_company ON inventory_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company ON purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_company ON goods_receipts(company_id);

-- Assets
CREATE INDEX IF NOT EXISTS idx_fixed_assets_company ON fixed_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_depreciation_entries_company ON depreciation_entries(company_id);

-- HR
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
-- CREATE INDEX IF NOT EXISTS idx_payroll_company ON payroll(company_id); -- Table doesn't exist

-- Tour Module
CREATE INDEX IF NOT EXISTS idx_bookings_company ON bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_company_status ON bookings(company_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_company_date ON bookings(company_id, travel_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_tour_packages_company ON tour_packages(company_id);
CREATE INDEX IF NOT EXISTS idx_destinations_company ON destinations(company_id);
CREATE INDEX IF NOT EXISTS idx_hotels_company ON hotels(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicles(company_id);
-- CREATE INDEX IF NOT EXISTS idx_guides_company ON guides(company_id); -- Table doesn't exist

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================
-- 
-- After running this migration:
-- 1. company_id columns are added but nullable (no data yet)
-- 2. Indexes are created for performance
-- 3. Next step: Run migration 044 to migrate existing data
-- 4. Then run migration 045 to enable RLS policies
-- 
-- DO NOT set company_id to NOT NULL yet!
-- We'll do that after data migration.






