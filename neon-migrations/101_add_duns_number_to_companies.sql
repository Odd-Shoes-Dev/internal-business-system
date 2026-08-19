-- Migration 101: Add DUNS number field to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS duns_number TEXT;
