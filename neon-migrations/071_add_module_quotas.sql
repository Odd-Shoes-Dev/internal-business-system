-- Migration 071: Add Module Quotas and Included Modules System
-- Implements Option A: Starter=1, Professional=3, Enterprise=All modules

-- Add module quota tracking to company_settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS included_modules_quota INTEGER DEFAULT 1;

-- Add is_included flag to subscription_modules to differentiate included vs paid modules
ALTER TABLE subscription_modules
ADD COLUMN IF NOT EXISTS is_included BOOLEAN DEFAULT false;

-- Function to get module quota based on plan tier
CREATE OR REPLACE FUNCTION get_module_quota(plan_tier TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE
    WHEN plan_tier = 'starter' THEN 1
    WHEN plan_tier = 'professional' THEN 3
    WHEN plan_tier = 'enterprise' THEN 999  -- Unlimited (all 6 modules)
    ELSE 1
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update module quota when plan changes
CREATE OR REPLACE FUNCTION update_module_quota_on_plan_change()
RETURNS TRIGGER AS $$
DECLARE
  new_quota INTEGER;
BEGIN
  -- Calculate new quota based on plan tier
  new_quota := get_module_quota(NEW.plan_tier);
  
  -- Update company_settings with new quota
  UPDATE company_settings
  SET included_modules_quota = new_quota
  WHERE company_id = NEW.company_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update quota when subscription plan changes
DROP TRIGGER IF EXISTS trigger_update_module_quota ON subscriptions;
CREATE TRIGGER trigger_update_module_quota
  AFTER INSERT OR UPDATE OF plan_tier ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_module_quota_on_plan_change();

-- Update existing company_settings with correct quotas based on current subscription
UPDATE company_settings cs
SET included_modules_quota = get_module_quota(
  COALESCE(
    (SELECT plan_tier FROM subscriptions WHERE company_id = cs.company_id LIMIT 1),
    cs.plan_tier
  )
);

-- Mark existing modules as included if within quota
-- This ensures current trial users get their modules marked as included
WITH ranked_modules AS (
  SELECT 
    id,
    company_id,
    ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY added_at ASC) as rn
  FROM subscription_modules
  WHERE is_active = true
),
company_quotas AS (
  SELECT 
    cs.company_id,
    cs.included_modules_quota
  FROM company_settings cs
)
UPDATE subscription_modules sm
SET is_included = true
FROM ranked_modules rm
JOIN company_quotas cq ON rm.company_id = cq.company_id
WHERE sm.id = rm.id
  AND rm.rn <= cq.included_modules_quota;

-- Create index for faster quota queries
CREATE INDEX IF NOT EXISTS idx_subscription_modules_included ON subscription_modules(company_id, is_included) WHERE is_active = true;

-- Add comments
COMMENT ON COLUMN company_settings.included_modules_quota IS 'Number of modules included in the plan: Starter=1, Professional=3, Enterprise=All';
COMMENT ON COLUMN subscription_modules.is_included IS 'True if module is within the plan quota (free), false if additional paid module';
COMMENT ON FUNCTION get_module_quota IS 'Returns module quota based on plan tier: starter=1, professional=3, enterprise=unlimited';
