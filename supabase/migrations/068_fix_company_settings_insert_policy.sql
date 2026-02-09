-- Migration 068: Fix company_settings RLS - Add INSERT policy
-- This allows authenticated users to create company_settings records

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Anyone can view company settings" ON company_settings;
DROP POLICY IF EXISTS "Only admins can update company settings" ON company_settings;

-- Allow authenticated users to insert company_settings (needed for new companies)
CREATE POLICY "Authenticated users can insert company settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be creating settings for their own company
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Allow authenticated users to view company settings for their company
CREATE POLICY "Users can view their company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Allow authenticated users to update their company settings
CREATE POLICY "Users can update their company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

COMMENT ON POLICY "Authenticated users can insert company settings" ON company_settings IS 
  'Allows authenticated users to create company_settings for their own company';
COMMENT ON POLICY "Users can view their company settings" ON company_settings IS 
  'Allows users to view settings for their company';
COMMENT ON POLICY "Users can update their company settings" ON company_settings IS 
  'Allows users to update settings for their company';
