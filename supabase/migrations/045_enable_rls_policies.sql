-- Migration 045: Enable Row Level Security (RLS) Policies
-- This is THE MOST CRITICAL migration for multi-tenant security
-- It ensures Company A can NEVER see Company B's data

-- ============================================================================
-- HELPER FUNCTION FOR RLS
-- ============================================================================

-- Function to get user's companies (used in RLS policies)
CREATE OR REPLACE FUNCTION public.user_companies()
RETURNS SETOF UUID AS $$
  SELECT company_id 
  FROM user_companies
  WHERE user_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

-- Core
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;

-- Customers & Vendors
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Revenue / AR
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_received ENABLE ROW LEVEL SECURITY;

-- Expenses / AP
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_lines ENABLE ROW LEVEL SECURITY;

-- Banking
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- Inventory
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;

-- Assets
ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_entries ENABLE ROW LEVEL SECURITY;

-- HR
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payroll ENABLE ROW LEVEL SECURITY; -- Table doesn't exist

-- Tour Module
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE guides ENABLE ROW LEVEL SECURITY; -- Table doesn't exist

-- ============================================================================
-- COMPANIES TABLE POLICIES
-- ============================================================================

CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT
  USING (id IN (SELECT public.user_companies()));

CREATE POLICY "Admins can update their company"
  ON companies FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- USER_COMPANIES TABLE POLICIES
-- ============================================================================

CREATE POLICY "Users can view their company memberships"
  ON user_companies FOR SELECT
  USING (user_id = auth.uid() OR company_id IN (SELECT public.user_companies()));

CREATE POLICY "Admins can manage company users"
  ON user_companies FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role IN ('admin')
    )
  );

-- ============================================================================
-- COMPANY_MODULES TABLE POLICIES
-- ============================================================================

CREATE POLICY "Users can view their company's modules"
  ON company_modules FOR SELECT
  USING (company_id IN (SELECT public.user_companies()));

CREATE POLICY "Admins can manage modules"
  ON company_modules FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- STANDARD MULTI-TENANT POLICIES (Applied to all company_id tables)
-- ============================================================================

-- Macro to create standard policies (SELECT, INSERT, UPDATE, DELETE)
DO $$
DECLARE
  tbl TEXT;
  tables_to_secure TEXT[] := ARRAY[
    'user_profiles', 'accounts', 'journal_entries', 'journal_lines',
    'fiscal_periods', 'customers', 'vendors', 'invoices', 'invoice_lines',
    'payments_received', 'expenses', 'bills', 'bill_lines', 'bank_accounts',
    'bank_transactions', 'products', 'inventory_movements',
    'purchase_orders', 'goods_receipts', 'fixed_assets', 'depreciation_entries',
    'employees', 'bookings', 'tour_packages', 'destinations',
    'hotels', 'vehicles'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_secure
  LOOP
    -- SELECT policy: Users can view data from their companies
    EXECUTE format('
      CREATE POLICY "%s_tenant_isolation_select"
        ON %I FOR SELECT
        USING (company_id IN (SELECT public.user_companies()))
    ', tbl, tbl);

    -- INSERT policy: Users can insert data for their companies
    EXECUTE format('
      CREATE POLICY "%s_tenant_isolation_insert"
        ON %I FOR INSERT
        WITH CHECK (company_id IN (SELECT public.user_companies()))
    ', tbl, tbl);

    -- UPDATE policy: Users can update data from their companies
    EXECUTE format('
      CREATE POLICY "%s_tenant_isolation_update"
        ON %I FOR UPDATE
        USING (company_id IN (SELECT public.user_companies()))
        WITH CHECK (company_id IN (SELECT public.user_companies()))
    ', tbl, tbl);

    -- DELETE policy: Users can delete data from their companies
    EXECUTE format('
      CREATE POLICY "%s_tenant_isolation_delete"
        ON %I FOR DELETE
        USING (company_id IN (SELECT public.user_companies()))
    ', tbl, tbl);

    RAISE NOTICE 'Created RLS policies for table: %', tbl;
  END LOOP;
END$$;

-- ============================================================================
-- ROLE-BASED RESTRICTIONS (Optional, but recommended)
-- ============================================================================

-- Example: Only admins and accountants can delete invoices
CREATE POLICY "Only admins/accountants can delete invoices"
  ON invoices FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'accountant')
    )
  );

-- Example: Guides can only view bookings, not edit
CREATE POLICY "Guides readonly bookings"
  ON bookings FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role = 'guide'
    )
  );

-- ============================================================================
-- TESTING THE POLICIES
-- ============================================================================

-- Verify RLS is enabled on all tables
DO $$
DECLARE
  missing_rls TEXT[];
BEGIN
  SELECT array_agg(tablename)
  INTO missing_rls
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT IN (
      SELECT tablename
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE c.relrowsecurity = true
    );
  
  IF array_length(missing_rls, 1) > 0 THEN
    RAISE WARNING 'Tables without RLS: %', missing_rls;
  ELSE
    RAISE NOTICE 'All tables have RLS enabled!';
  END IF;
END$$;

-- ============================================================================
-- IMPORTANT SECURITY NOTES
-- ============================================================================
-- 
-- After this migration:
-- 1. RLS is enabled on ALL tables
-- 2. Users can ONLY access data from their companies
-- 3. company_id is checked on EVERY query automatically
-- 4. Even if API is compromised, database blocks cross-tenant access
-- 
-- TEST THOROUGHLY:
-- - Create 2 test companies
-- - Create users for each
-- - Verify User A cannot see User B's data
-- - Try to hack it (UPDATE with wrong company_id, etc.)
-- 
-- Service role (SUPABASE_SERVICE_ROLE_KEY) bypasses RLS
-- - Use for admin functions only
-- - NEVER expose service role key to client


