-- Migration 078: Add company_id to bank_accounts
-- bank_accounts was originally single-tenant; add company_id for multi-tenant filtering.

ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_accounts_company_id ON bank_accounts(company_id);
