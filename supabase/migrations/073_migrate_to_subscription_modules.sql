-- Migration 073: Migrate Company Modules to Subscription Modules
-- Migrates existing industry module data from company_modules to subscription_modules
-- Preserves existing module selections while transitioning to new system

-- First, ensure subscription_modules table has all required columns
-- (This should already exist from migration 057, but let's be safe)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscription_modules') THEN
    RAISE EXCEPTION 'subscription_modules table does not exist. Run migration 057 first.';
  END IF;
END $$;

-- Migrate existing module data from company_modules to subscription_modules
-- Only migrate optional industry modules (not core accounting features)
INSERT INTO subscription_modules (
  company_id, 
  module_id, 
  is_active, 
  monthly_price, 
  currency,
  is_trial_module,
  added_at,
  created_at
)
SELECT 
  cm.company_id,
  cm.module_id,
  cm.enabled as is_active,
  -- Pricing based on module type (USD default)
  CASE 
    WHEN cm.module_id = 'tours' THEN 39.00
    WHEN cm.module_id = 'fleet' THEN 35.00
    WHEN cm.module_id = 'hotels' THEN 45.00
    WHEN cm.module_id = 'cafe' THEN 49.00
    WHEN cm.module_id = 'inventory' THEN 39.00
    WHEN cm.module_id = 'payroll' THEN 35.00
    WHEN cm.module_id = 'retail' THEN 45.00
    WHEN cm.module_id = 'security' THEN 29.00
    ELSE 39.00 -- Default for unknown modules
  END as monthly_price,
  -- Currency based on company's region
  COALESCE(
    (SELECT 
      CASE 
        WHEN c.region = 'AFRICA' THEN 'UGX'
        WHEN c.region = 'GB' THEN 'GBP'
        WHEN c.region = 'EU' THEN 'EUR'
        ELSE 'USD'
      END
     FROM companies c WHERE c.id = cm.company_id
    ),
    'USD'
  ) as currency,
  -- Mark as trial module if company is in trial
  EXISTS(
    SELECT 1 FROM companies c 
    WHERE c.id = cm.company_id 
    AND c.subscription_status = 'trial'
  ) as is_trial_module,
  COALESCE(cm.enabled_at, NOW()) as added_at,
  NOW() as created_at
FROM company_modules cm
WHERE 
  -- Only migrate industry modules (not core accounting features)
  cm.module_id IN ('tours', 'fleet', 'hotels', 'cafe', 'inventory', 'payroll', 'retail', 'security')
  -- Don't duplicate if already exists in subscription_modules
  AND NOT EXISTS (
    SELECT 1 FROM subscription_modules sm 
    WHERE sm.company_id = cm.company_id 
    AND sm.module_id = cm.module_id
  )
  -- Only migrate enabled modules (ignore disabled ones)
  AND cm.enabled = true;

-- Log migration results
DO $$
DECLARE
  migrated_count INTEGER;
  core_modules_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM subscription_modules;
  SELECT COUNT(*) INTO core_modules_count 
  FROM company_modules 
  WHERE module_id IN ('accounting', 'invoicing', 'expenses', 'customers', 'vendors', 'reports');
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  - Industry modules in subscription_modules: %', migrated_count;
  RAISE NOTICE '  - Core module records (will be ignored): %', core_modules_count;
  RAISE NOTICE '  - Core features are always enabled (no table tracking)';
END $$;

-- Add helpful comments
COMMENT ON TABLE subscription_modules IS 'Tracks active industry modules per company with pricing. Core features (accounting, invoicing, etc.) are always enabled and not tracked here.';

-- Create view for easy module checking (includes core modules implicitly)
CREATE OR REPLACE VIEW company_enabled_modules AS
SELECT 
  c.id as company_id,
  -- Core modules (always enabled for all companies)
  'accounting' as module_id,
  true as is_active,
  'core' as module_type
FROM companies c
UNION ALL
SELECT 
  c.id as company_id,
  'invoicing' as module_id,
  true as is_active,
  'core' as module_type
FROM companies c
UNION ALL
SELECT 
  c.id as company_id,
  'expenses' as module_id,
  true as is_active,
  'core' as module_type
FROM companies c
UNION ALL
SELECT 
  c.id as company_id,
  'customers' as module_id,
  true as is_active,
  'core' as module_type
FROM companies c
UNION ALL
SELECT 
  c.id as company_id,
  'vendors' as module_id,
  true as is_active,
  'core' as module_type
FROM companies c
UNION ALL
SELECT 
  c.id as company_id,
  'reports' as module_id,
  true as is_active,
  'core' as module_type
FROM companies c
UNION ALL
-- Industry modules from subscription_modules
SELECT 
  sm.company_id,
  sm.module_id,
  sm.is_active,
  'industry' as module_type
FROM subscription_modules sm
WHERE sm.is_active = true;

COMMENT ON VIEW company_enabled_modules IS 'Unified view of all enabled modules including core (always on) and industry modules (from subscription_modules)';

-- Don't delete company_modules table yet - keep for safety/rollback
-- Can be dropped manually later after verification:
-- DROP TABLE IF EXISTS company_modules CASCADE;

-- Migration complete - verify results by querying:
-- SELECT * FROM subscription_modules;
-- SELECT * FROM company_enabled_modules;
