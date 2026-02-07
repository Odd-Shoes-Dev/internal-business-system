-- Create subscriptions table for detailed subscription tracking

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Plan details
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('starter', 'professional', 'enterprise')),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  
  -- Dates
  trial_start_date TIMESTAMP,
  trial_end_date TIMESTAMP,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMP,
  
  -- Pricing snapshot (at time of subscription)
  base_price_amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  discount_percent INTEGER DEFAULT 0,
  
  -- Pending changes
  pending_plan_change TEXT,
  plan_change_at TIMESTAMP,
  
  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_payment_method_id TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- RLS Policies
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company subscription"
ON subscriptions
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM user_profiles WHERE id = auth.uid()
));

CREATE POLICY "Only company owners can manage subscriptions"
ON subscriptions
FOR ALL
USING (
  company_id IN (
    SELECT company_id FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Comments
COMMENT ON TABLE subscriptions IS 'Detailed subscription tracking with Stripe integration';
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS 'If true, subscription will cancel at end of current period';
COMMENT ON COLUMN subscriptions.pending_plan_change IS 'Plan to change to at next renewal';
