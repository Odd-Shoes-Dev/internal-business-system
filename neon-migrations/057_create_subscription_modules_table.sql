-- Create subscription_modules table for tracking active modules per company

CREATE TABLE IF NOT EXISTS subscription_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL CHECK (module_id IN ('tours', 'fleet', 'hotels', 'cafe', 'security', 'inventory')),
  
  -- Pricing snapshot (at time module was added)
  monthly_price DECIMAL(10, 2) NOT NULL,
  setup_fee DECIMAL(10, 2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_trial_module BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMP DEFAULT NOW(),
  removed_at TIMESTAMP,
  next_billing_date TIMESTAMP,
  
  -- Stripe integration
  stripe_subscription_item_id TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicate active modules
  UNIQUE(company_id, module_id, is_active)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_modules_company ON subscription_modules(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_modules_active ON subscription_modules(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_modules_module ON subscription_modules(module_id);

-- RLS Policies
ALTER TABLE subscription_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company modules"
ON subscription_modules
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM user_profiles WHERE id = auth.uid()
));

CREATE POLICY "Only admins can manage modules"
ON subscription_modules
FOR ALL
USING (
  company_id IN (
    SELECT company_id FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Function to check module access
CREATE OR REPLACE FUNCTION has_module_access(p_company_id UUID, p_module_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscription_modules
    WHERE company_id = p_company_id
      AND module_id = p_module_id
      AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE subscription_modules IS 'Tracks active industry modules per company with pricing snapshots';
COMMENT ON COLUMN subscription_modules.is_trial_module IS 'True if module was selected during trial period';
COMMENT ON COLUMN subscription_modules.removed_at IS 'When module was deactivated, NULL if still active';
COMMENT ON FUNCTION has_module_access IS 'Check if company has access to a specific module';
