-- Core accounting fixes (2026-07-13).
-- Adds missing columns + the bank_transfers table that GET/approve routes expect.

-- ── invoices: revenue recognition columns ──────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS revenue_recognized_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS revenue_recognition_date DATE;

-- Backfill: invoices where revenue was already fully recognized have no tracking data,
-- so we leave them at 0 — the route guards against re-recognition via service_end_date.

-- ── bank_transfers table ────────────────────────────────────────
-- The GET/DELETE/approve routes reference this table; the POST was writing only to
-- bank_transactions. Now both write to bank_transfers so they stay in sync.
CREATE TABLE IF NOT EXISTS bank_transfers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_account_id     UUID NOT NULL REFERENCES bank_accounts(id),
  to_account_id       UUID NOT NULL REFERENCES bank_accounts(id),
  amount              NUMERIC(15,2) NOT NULL,
  transfer_date       DATE NOT NULL,
  description         TEXT,
  reference_number    VARCHAR(100),
  notes               TEXT,
  status              VARCHAR(20) DEFAULT 'completed'
                        CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
  journal_entry_id    UUID REFERENCES journal_entries(id),
  from_transaction_id UUID REFERENCES bank_transactions(id),
  to_transaction_id   UUID REFERENCES bank_transactions(id),
  approved_by         UUID REFERENCES user_profiles(id),
  approved_at         TIMESTAMPTZ,
  created_by          UUID REFERENCES user_profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_transfers_company_id  ON bank_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_from_account ON bank_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_to_account   ON bank_transfers(to_account_id);
