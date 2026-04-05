-- Migration 067: Add company_id to company_settings for multi-tenant support

ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_company_settings_company ON company_settings(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_settings_company_unique ON company_settings(company_id) WHERE company_id IS NOT NULL;

-- Link existing settings row(s) to first available company when upgrading from legacy data.
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM companies ORDER BY created_at ASC LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    UPDATE company_settings
    SET company_id = v_company_id
    WHERE company_id IS NULL;
  END IF;
END $$;

COMMENT ON COLUMN company_settings.company_id IS 'Company-scoped settings record (one row per company)';
