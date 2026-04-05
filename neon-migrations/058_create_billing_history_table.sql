-- Create billing_history table for payment and invoice tracking

CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  
  -- Invoice details
  invoice_number TEXT,
  invoice_url TEXT,
  invoice_pdf_url TEXT,
  
  -- Period covered by this payment
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  
  -- Cost breakdown
  base_plan_cost DECIMAL(10, 2),
  modules_cost DECIMAL(10, 2),
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- Stripe integration
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  
  -- Dates
  paid_at TIMESTAMP,
  failed_at TIMESTAMP,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_history_company ON billing_history(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_status ON billing_history(status);
CREATE INDEX IF NOT EXISTS idx_billing_history_period ON billing_history(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_billing_history_stripe_invoice ON billing_history(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_created ON billing_history(created_at DESC);

-- RLS Policies
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company billing history"
ON billing_history
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM user_profiles WHERE id = auth.uid()
));

CREATE POLICY "Only system can insert billing records"
ON billing_history
FOR INSERT
WITH CHECK (false); -- Only via backend API

-- Comments
COMMENT ON TABLE billing_history IS 'Complete payment and invoice history for all companies';
COMMENT ON COLUMN billing_history.invoice_number IS 'Unique invoice number (e.g., INV-2026-0001)';
COMMENT ON COLUMN billing_history.failure_reason IS 'Stripe error message if payment failed';
