-- Migration 096: POS Module Foundation
-- Adds barcode support to products, payment source tracking,
-- and core POS tables (terminals + sessions)

-- ─── 1. Barcode on products ───────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);

-- Unique per company (two different companies can use the same barcode for different products)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_company
  ON products(company_id, barcode)
  WHERE barcode IS NOT NULL;

-- Fast barcode lookup at the till
CREATE INDEX IF NOT EXISTS idx_products_barcode
  ON products(barcode)
  WHERE barcode IS NOT NULL;

-- ─── 2. Payment source on payments_received ───────────────────────────────────
ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
-- values: 'manual' | 'pos'

-- ─── 3. POS terminals ─────────────────────────────────────────────────────────
-- One row per physical till device registered to a company
CREATE TABLE IF NOT EXISTS pos_terminals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,  -- e.g. "Till 1", "Front Counter", "Cafe Bar"
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_terminals_company
  ON pos_terminals(company_id);

-- ─── 4. POS sessions (shifts) ─────────────────────────────────────────────────
-- One row per cashier shift on a terminal
CREATE TABLE IF NOT EXISTS pos_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  terminal_id          UUID NOT NULL REFERENCES pos_terminals(id),
  opened_by            UUID NOT NULL REFERENCES user_profiles(id),
  closed_by            UUID REFERENCES user_profiles(id),

  opened_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at            TIMESTAMPTZ,

  opening_float        NUMERIC(15,2) NOT NULL DEFAULT 0,  -- cash in drawer at shift start
  closing_cash_count   NUMERIC(15,2),                     -- cash counted at shift end
  expected_cash        NUMERIC(15,2),                     -- float + total cash sales
  variance             NUMERIC(15,2),                     -- closing_cash_count - expected_cash

  total_sales          NUMERIC(15,2) NOT NULL DEFAULT 0,  -- running total, updated per transaction
  transaction_count    INTEGER NOT NULL DEFAULT 0,        -- running count

  currency             VARCHAR(10) NOT NULL DEFAULT 'UGX',
  status               VARCHAR(10) NOT NULL DEFAULT 'open', -- 'open' | 'closed'
  notes                TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_sessions_company
  ON pos_sessions(company_id);

CREATE INDEX IF NOT EXISTS idx_pos_sessions_terminal
  ON pos_sessions(terminal_id);

CREATE INDEX IF NOT EXISTS idx_pos_sessions_company_status
  ON pos_sessions(company_id, status);

-- ─── 5. Link POS sessions to invoices/payments ────────────────────────────────
-- Track which POS session each transaction belongs to
ALTER TABLE payments_received
  ADD COLUMN IF NOT EXISTS pos_session_id UUID REFERENCES pos_sessions(id);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pos_session_id UUID REFERENCES pos_sessions(id);

CREATE INDEX IF NOT EXISTS idx_payments_pos_session
  ON payments_received(pos_session_id)
  WHERE pos_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_pos_session
  ON invoices(pos_session_id)
  WHERE pos_session_id IS NOT NULL;

-- ─── 6. Performance indexes (from scalability audit) ─────────────────────────
-- Add missing company_id indexes on high-traffic tables

CREATE INDEX IF NOT EXISTS idx_invoices_company_status
  ON invoices(company_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_company_date
  ON invoices(company_id, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_customer
  ON invoices(company_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_bills_company_status
  ON bills(company_id, status);

CREATE INDEX IF NOT EXISTS idx_expenses_company_date
  ON expenses(company_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_customers_company_active
  ON customers(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_payments_company_date
  ON payments_received(company_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_payments_customer
  ON payments_received(company_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_company_date
  ON journal_entries(company_id, entry_date DESC);
