-- =====================================================
-- Fix User Companies Infinite Recursion (Final Fix)
-- Disable RLS on user_companies table to prevent recursion
-- =====================================================

-- The user_companies table doesn't need RLS because:
-- 1. Users can only see their own memberships via user_id = auth.uid()
-- 2. The function user_companies() creates infinite loop with RLS
-- 3. This is a junction table, actual security is on companies table

-- Disable RLS on user_companies
ALTER TABLE user_companies DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies (they're not needed)
DROP POLICY IF EXISTS "Users can view their own companies" ON user_companies;
DROP POLICY IF EXISTS "Service role can manage user companies" ON user_companies;
DROP POLICY IF EXISTS "Users can insert user companies" ON user_companies;
DROP POLICY IF EXISTS "Users can update user companies" ON user_companies;
DROP POLICY IF EXISTS "Users can delete user companies" ON user_companies;

-- Now recreate the function - it can safely query user_companies without RLS
DROP FUNCTION IF EXISTS public.user_companies() CASCADE;

CREATE OR REPLACE FUNCTION public.user_companies()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT company_id 
  FROM public.user_companies
  WHERE user_id = auth.uid();
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.user_companies() TO authenticated;

-- Recreate all the policies that depend on this function
-- (These were dropped by CASCADE above)

-- Companies
DROP POLICY IF EXISTS "Users can view their companies" ON companies;
CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT
  USING (id IN (SELECT public.user_companies()));

-- User profiles
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete" ON user_profiles;

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

-- Company modules
DROP POLICY IF EXISTS "Users can view their company modules" ON company_modules;
CREATE POLICY "Users can view their company modules"
  ON company_modules FOR SELECT
  USING (company_id IN (SELECT public.user_companies()));

-- Recreate policies for all company tables
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
    -- Drop existing policies first
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I', tbl, tbl);

    -- Recreate policies
    EXECUTE format('
      CREATE POLICY "%s_select"
        ON %I FOR SELECT
        USING (company_id IN (SELECT public.user_companies()))
    ', tbl, tbl);

    EXECUTE format('
      CREATE POLICY "%s_insert"
        ON %I FOR INSERT
        WITH CHECK (company_id IN (SELECT public.user_companies()))
    ', tbl, tbl);

    EXECUTE format('
      CREATE POLICY "%s_update"
        ON %I FOR UPDATE
        USING (company_id IN (SELECT public.user_companies()))
        WITH CHECK (company_id IN (SELECT public.user_companies()))
    ', tbl, tbl);

    EXECUTE format('
      CREATE POLICY "%s_delete"
        ON %I FOR DELETE
        USING (company_id IN (SELECT public.user_companies()))
    ', tbl, tbl);

    RAISE NOTICE 'Recreated RLS policies for table: %', tbl;
  END LOOP;
END$$;

COMMENT ON TABLE user_companies IS 'RLS disabled - security enforced by user_id = auth.uid() in function';
COMMENT ON FUNCTION public.user_companies() IS 'Returns company IDs for current user. RLS disabled on user_companies table to prevent recursion.';
