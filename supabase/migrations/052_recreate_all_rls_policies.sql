-- =====================================================
-- Recreate ALL RLS Policies After Function Drop
-- This recreates the 119 policies that were dropped
-- =====================================================

-- First, recreate the user_companies function without recursion issues
CREATE OR REPLACE FUNCTION public.user_companies()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  -- Use a direct query that bypasses RLS
  SELECT company_id 
  FROM public.user_companies
  WHERE user_id = auth.uid();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.user_companies() TO authenticated;

-- ============================================================================
-- MULTI-TENANT CORE TABLES
-- ============================================================================

-- Companies: Users can view companies they belong to
DROP POLICY IF EXISTS "Users can view their companies" ON companies;
CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT
  USING (id IN (SELECT public.user_companies()));

-- User Companies: Users can view their own memberships
DROP POLICY IF EXISTS "Users can view their own companies" ON user_companies;
DROP POLICY IF EXISTS "Service role can manage user companies" ON user_companies;

CREATE POLICY "Users can view their own companies"
  ON user_companies FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage user companies"
  ON user_companies FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Company Modules: Users can view their company's modules
DROP POLICY IF EXISTS "Users can view their company modules" ON company_modules;
CREATE POLICY "Users can view their company modules"
  ON company_modules FOR SELECT
  USING (company_id IN (SELECT public.user_companies()));

-- ============================================================================
-- USER PROFILES
-- ============================================================================

CREATE POLICY "user_profiles_select"
  ON user_profiles FOR SELECT
  USING (company_id IN (SELECT public.user_companies()) OR id = auth.uid());

CREATE POLICY "user_profiles_insert"
  ON user_profiles FOR INSERT
  WITH CHECK (company_id IN (SELECT public.user_companies()));

CREATE POLICY "user_profiles_update"
  ON user_profiles FOR UPDATE
  USING (company_id IN (SELECT public.user_companies()))
  WITH CHECK (company_id IN (SELECT public.user_companies()));

CREATE POLICY "user_profiles_delete"
  ON user_profiles FOR DELETE
  USING (company_id IN (SELECT public.user_companies()));

-- ============================================================================
-- STANDARD MULTI-TENANT POLICIES FOR ALL COMPANY TABLES
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
  tables_to_secure TEXT[] := ARRAY[
    'accounts', 'journal_entries', 'journal_lines', 'fiscal_periods',
    'customers', 'vendors', 'invoices', 'invoice_lines', 'payments_received',
    'expenses', 'bills', 'bill_lines', 'bank_accounts', 'bank_transactions',
    'products', 'inventory_movements', 'purchase_orders', 'goods_receipts',
    'fixed_assets', 'depreciation_entries', 'employees', 'bookings',
    'tour_packages', 'destinations', 'hotels', 'vehicles', 'stock_takes',
    'salary_advances'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_secure
  LOOP
    -- SELECT policy
    EXECUTE format('
      CREATE POLICY "%s_select"
        ON %I FOR SELECT
        USING (company_id IN (SELECT public.user_companies()))
    ', tbl, tbl);

    -- INSERT policy
    EXECUTE format('
      CREATE POLICY "%s_insert"
        ON %I FOR INSERT
        WITH CHECK (company_id IN (SELECT public.user_companies()))
    ', tbl, tbl);

    -- UPDATE policy
    EXECUTE format('
      CREATE POLICY "%s_update"
        ON %I FOR UPDATE
        USING (company_id IN (SELECT public.user_companies()))
        WITH CHECK (company_id IN (SELECT public.user_companies()))
    ', tbl, tbl);

    -- DELETE policy
    EXECUTE format('
      CREATE POLICY "%s_delete"
        ON %I FOR DELETE
        USING (company_id IN (SELECT public.user_companies()))
    ', tbl, tbl);

    RAISE NOTICE 'Created RLS policies for table: %', tbl;
  END LOOP;
END$$;

COMMENT ON FUNCTION public.user_companies() IS 'Returns company IDs for current user. Uses SECURITY DEFINER to bypass RLS on user_companies table.';
