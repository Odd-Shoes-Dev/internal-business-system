-- Migration 083: Add company_id to fixed_assets for multi-tenant support

ALTER TABLE fixed_assets
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_company ON fixed_assets(company_id);

-- Backfill existing records with the first company
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM companies ORDER BY created_at ASC LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    UPDATE fixed_assets SET company_id = v_company_id WHERE company_id IS NULL;
  END IF;
END $$;
