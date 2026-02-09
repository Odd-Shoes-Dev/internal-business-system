-- Migration 067: Add company_id to company_settings for multi-tenant support
-- This fixes the issue where company_settings doesn't have company_id

-- Add company_id column to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_company_settings_company ON company_settings(company_id);

-- Add unique constraint - one settings record per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_settings_company_unique ON company_settings(company_id) WHERE company_id IS NOT NULL;

-- Update existing records to link to companies table if they exist
-- This handles cases where there's existing data without proper company linkage
DO $$
DECLARE
  v_company_id UUID;
  v_settings_id UUID;
BEGIN
  -- Get the first company (for single-tenant legacy data)
  SELECT id INTO v_company_id FROM companies LIMIT 1;
  
  IF v_company_id IS NOT NULL THEN
    -- Update any company_settings records that don't have a company_id
    UPDATE company_settings 
    SET company_id = v_company_id
    WHERE company_id IS NULL;
  END IF;
END$$;

COMMENT ON COLUMN company_settings.company_id IS 'Links company_settings to companies table for multi-tenant support';
