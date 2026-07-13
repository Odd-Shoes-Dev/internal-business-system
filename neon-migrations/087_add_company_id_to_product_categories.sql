-- Migration 087: Add company_id to product_categories
-- The API already filters by company_id but the column was never created.

ALTER TABLE product_categories
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_categories_company_id ON product_categories(company_id);
