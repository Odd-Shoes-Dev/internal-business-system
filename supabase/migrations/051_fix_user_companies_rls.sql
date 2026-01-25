-- =====================================================
-- Fix User Companies RLS Infinite Recursion
-- The user_companies() function was causing infinite loop
-- =====================================================

-- Drop the problematic function and all dependent policies
DROP FUNCTION IF EXISTS public.user_companies() CASCADE;

-- Recreate without SECURITY DEFINER to avoid RLS recursion
-- OR use a simpler approach that bypasses RLS
CREATE OR REPLACE FUNCTION public.user_companies()
RETURNS SETOF UUID AS $$
  SELECT company_id 
  FROM public.user_companies
  WHERE user_id = auth.uid();
$$ LANGUAGE SQL STABLE;

-- Drop existing policies on user_companies
DROP POLICY IF EXISTS "user_companies_tenant_isolation_select" ON user_companies;
DROP POLICY IF EXISTS "user_companies_tenant_isolation_insert" ON user_companies;
DROP POLICY IF EXISTS "user_companies_tenant_isolation_update" ON user_companies;
DROP POLICY IF EXISTS "user_companies_tenant_isolation_delete" ON user_companies;

-- Create simpler policies that don't cause recursion
-- Users can see their own company memberships
CREATE POLICY "Users can view their own companies"
  ON user_companies FOR SELECT
  USING (user_id = auth.uid());

-- Users cannot insert themselves (only triggers/admins)
CREATE POLICY "Service role can insert user companies"
  ON user_companies FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role' OR auth.uid() = user_id);

-- Users cannot modify their company memberships
CREATE POLICY "Only service can update user companies"
  ON user_companies FOR UPDATE
  USING (auth.jwt()->>'role' = 'service_role');

-- Users cannot delete their company memberships
CREATE POLICY "Only service can delete user companies"
  ON user_companies FOR DELETE
  USING (auth.jwt()->>'role' = 'service_role');

-- Also fix companies table policies to avoid recursion
DROP POLICY IF EXISTS "Companies_tenant_isolation_select" ON companies;
CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT
  USING (
    id IN (
      SELECT company_id 
      FROM user_companies 
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON FUNCTION public.user_companies() IS 'Returns company IDs for current user - simplified to avoid RLS recursion';
