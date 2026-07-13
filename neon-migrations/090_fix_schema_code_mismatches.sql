-- Fix schema/code mismatches found in full API audit (2026-07-13).
-- All changes are additive (safe): columns the application code already
-- writes/reads but which never existed in the schema, causing 500s.

-- ── journal_lines ──────────────────────────────────────────────
-- Inserted by: journal-entries POST/PUT, cafe sales, depreciation post/run,
-- payroll process, petty-cash approve/replenish, revenue recognize,
-- salon webhook, stripe webhook, bank-transactions.
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS created_by UUID;

-- Backfill company_id from the parent journal entry
UPDATE journal_lines jl
SET company_id = je.company_id
FROM journal_entries je
WHERE je.id = jl.journal_entry_id
  AND jl.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_journal_lines_company_id ON journal_lines(company_id);

-- ── journal_entries ────────────────────────────────────────────
-- Inserted by: bank-transactions, bank-transfers, payroll, depreciation run,
-- petty-cash disbursements/replenishments.
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference VARCHAR(100);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_id UUID;

-- ── payments_received ──────────────────────────────────────────
-- Inserted by: receipts POST, receipts/[id]/payment, stripe webhook.
ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Backfill from the paying customer's company
UPDATE payments_received pr
SET company_id = c.company_id
FROM customers c
WHERE c.id = pr.customer_id
  AND pr.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_received_company_id ON payments_received(company_id);

-- ── bank_accounts ──────────────────────────────────────────────
-- Referenced by: bank reconciliation routes, companies/register,
-- and the update_bank_account_balance() function from migration 025.
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS current_balance NUMERIC(15,2) DEFAULT 0;

-- ── missing updated_at columns (UPDATE ... SET updated_at = NOW() crashes) ─
ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE salary_advances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE employee_reimbursements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE stock_takes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── stock_takes multi-tenancy ─────────────────────────────────
ALTER TABLE stock_takes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_stock_takes_company_id ON stock_takes(company_id);

-- ── fix broken trigger on payments_received ───────────────────
-- update_customer_balance_on_payment referenced NEW.invoice_id, which does
-- not exist on payments_received (customer_id is stored directly).
-- Same bug class as the bill_payments trigger fixed in migration 089.
CREATE OR REPLACE FUNCTION update_customer_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM update_customer_balance(NEW.customer_id, -NEW.amount);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
