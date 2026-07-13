-- Migration 092: Create petty cash tables and fix activity_logs columns.
-- Petty cash tables never existed — every disbursement/replenishment route was 500ing.
-- activity_logs was missing company_id and metadata, crashing 3 cron jobs.

-- ── petty_cash_disbursements ──────────────────────────────────
CREATE TABLE IF NOT EXISTS petty_cash_disbursements (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  disbursement_number VARCHAR(50) NOT NULL,
  cash_account_id     UUID NOT NULL REFERENCES bank_accounts(id),
  disbursement_date   DATE NOT NULL,
  amount              NUMERIC(15,2) NOT NULL,
  category            VARCHAR(100) NOT NULL,
  description         TEXT,
  recipient           VARCHAR(255) NOT NULL,
  receipt_number      VARCHAR(100),
  status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected', 'void')),
  notes               TEXT,
  created_by          UUID REFERENCES user_profiles(id),
  approved_by         UUID REFERENCES user_profiles(id),
  approved_at         TIMESTAMPTZ,
  journal_entry_id    UUID REFERENCES journal_entries(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, disbursement_number)
);

CREATE INDEX IF NOT EXISTS idx_pcd_company    ON petty_cash_disbursements(company_id);
CREATE INDEX IF NOT EXISTS idx_pcd_account    ON petty_cash_disbursements(cash_account_id);
CREATE INDEX IF NOT EXISTS idx_pcd_status     ON petty_cash_disbursements(status);

-- ── petty_cash_replenishments ─────────────────────────────────
CREATE TABLE IF NOT EXISTS petty_cash_replenishments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  replenishment_number  VARCHAR(50) NOT NULL,
  cash_account_id       UUID NOT NULL REFERENCES bank_accounts(id),
  bank_account_id       UUID NOT NULL REFERENCES bank_accounts(id),
  replenishment_date    DATE NOT NULL,
  amount                NUMERIC(15,2) NOT NULL,
  reference             VARCHAR(100),
  notes                 TEXT,
  journal_entry_id      UUID REFERENCES journal_entries(id),
  created_by            UUID REFERENCES user_profiles(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, replenishment_number)
);

CREATE INDEX IF NOT EXISTS idx_pcr_company     ON petty_cash_replenishments(company_id);
CREATE INDEX IF NOT EXISTS idx_pcr_cash_acct   ON petty_cash_replenishments(cash_account_id);
CREATE INDEX IF NOT EXISTS idx_pcr_bank_acct   ON petty_cash_replenishments(bank_account_id);

-- ── activity_logs: missing columns ───────────────────────────
-- company_id and metadata are written by admin feed + 3 cron jobs.
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS metadata   JSONB;

CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON activity_logs(company_id);
