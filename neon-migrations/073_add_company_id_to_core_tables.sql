-- Migration 073: Add company_id to core financial tables for multi-tenant support
-- The initial schema was single-tenant; this migration retrofits company scoping
-- to all major tables that the application queries with company_id.

-- ============================================================================
-- ACCOUNTS
-- ============================================================================
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);

-- ============================================================================
-- JOURNAL ENTRIES
-- ============================================================================
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id);

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);

-- ============================================================================
-- VENDORS
-- ============================================================================
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);

-- ============================================================================
-- PRODUCTS (inventory items)
-- ============================================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);

-- ============================================================================
-- INVOICES
-- ============================================================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);

-- ============================================================================
-- BILLS
-- ============================================================================
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bills_company ON bills(company_id);

-- ============================================================================
-- EXPENSES
-- ============================================================================
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);

-- ============================================================================
-- FISCAL PERIODS
-- ============================================================================
ALTER TABLE fiscal_periods
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_company ON fiscal_periods(company_id);

-- ============================================================================
-- BACKFILL: Link all existing rows to the first (and likely only) company
-- Safe to run repeatedly — only sets NULL rows.
-- ============================================================================
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM companies ORDER BY created_at ASC LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    UPDATE accounts        SET company_id = v_company_id WHERE company_id IS NULL;
    UPDATE journal_entries SET company_id = v_company_id WHERE company_id IS NULL;
    UPDATE customers       SET company_id = v_company_id WHERE company_id IS NULL;
    UPDATE vendors         SET company_id = v_company_id WHERE company_id IS NULL;
    UPDATE products        SET company_id = v_company_id WHERE company_id IS NULL;
    UPDATE invoices        SET company_id = v_company_id WHERE company_id IS NULL;
    UPDATE bills           SET company_id = v_company_id WHERE company_id IS NULL;
    UPDATE expenses        SET company_id = v_company_id WHERE company_id IS NULL;
    UPDATE fiscal_periods  SET company_id = v_company_id WHERE company_id IS NULL;
  END IF;
END $$;
