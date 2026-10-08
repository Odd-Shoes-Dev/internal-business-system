-- Migration 114: POS gaps ported from inventoryMgt
--
-- - Customers: WhatsApp number and loyalty points balance
-- - Loyalty ledger: every earn / redeem / reversal, so a balance can always be explained
-- - Held (parked) orders: a cart saved at the till and resumed later
-- - Returns: a return document per refund, with its lines, numbered RET-<year>-<seq>
-- - Per-company WhatsApp Business settings (one WhatsApp account per company) and a send log
-- - Shift refunds total, so expected cash at close subtracts cash refunds

ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points NUMERIC(15,2) NOT NULL DEFAULT 0;

ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS total_refunds NUMERIC(15,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  return_id UUID,
  points NUMERIC(15,2) NOT NULL, -- positive = earned, negative = redeemed / reversed
  type VARCHAR(20) NOT NULL CHECK (type IN ('earn', 'redeem', 'reverse', 'adjust')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_invoice ON loyalty_transactions (invoice_id);

CREATE TABLE IF NOT EXISTS pos_held_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_id UUID REFERENCES pos_sessions(id) ON DELETE SET NULL,
  label VARCHAR(100),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  cart JSONB NOT NULL,
  cart_discount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_held_orders_company ON pos_held_orders (company_id, created_at DESC);

CREATE SEQUENCE IF NOT EXISTS pos_return_number_seq;

CREATE OR REPLACE FUNCTION generate_pos_return_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'RET-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('pos_return_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS pos_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  session_id UUID REFERENCES pos_sessions(id) ON DELETE SET NULL,
  return_number VARCHAR(50) NOT NULL UNIQUE,
  reason TEXT,
  -- 'account' = credited against what the customer owes on the original (credit) sale
  refund_method VARCHAR(20) NOT NULL CHECK (refund_method IN ('cash', 'card', 'mobile_money', 'account')),
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_returns_invoice ON pos_returns (invoice_id);
CREATE INDEX IF NOT EXISTS idx_pos_returns_session ON pos_returns (session_id);

CREATE TABLE IF NOT EXISTS pos_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES pos_returns(id) ON DELETE CASCADE,
  invoice_line_id UUID NOT NULL REFERENCES invoice_lines(id),
  product_id UUID REFERENCES products(id),
  description TEXT,
  quantity NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(15,4) NOT NULL,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(15,2) NOT NULL, -- net of discount, before tax
  restock BOOLEAN NOT NULL DEFAULT true,
  unit_cost NUMERIC(15,4)
);
CREATE INDEX IF NOT EXISTS idx_pos_return_lines_invoice_line ON pos_return_lines (invoice_line_id);

CREATE TABLE IF NOT EXISTS company_whatsapp_settings (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  phone_number_id VARCHAR(64),
  access_token_encrypted TEXT, -- AES-256-GCM, key from APP_ENCRYPTION_KEY
  template_name VARCHAR(100) NOT NULL DEFAULT 'order_confirmation',
  template_language VARCHAR(10) NOT NULL DEFAULT 'en',
  default_country_code VARCHAR(5) NOT NULL DEFAULT '256',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  to_number VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_message_id VARCHAR(100),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_company ON whatsapp_message_logs (company_id, created_at DESC);
