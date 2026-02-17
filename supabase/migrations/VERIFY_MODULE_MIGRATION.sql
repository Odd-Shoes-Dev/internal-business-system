-- Verification Script: Check Module Data Before/After Migration
-- Run these queries to verify the migration worked correctly

-- ============================================================================
-- BEFORE MIGRATION - Check Current State
-- ============================================================================

-- 1. Check existing company_modules data
SELECT 
  cm.company_id,
  c.name as company_name,
  cm.module_id,
  cm.enabled,
  cm.enabled_at
FROM company_modules cm
JOIN companies c ON c.id = cm.company_id
ORDER BY cm.company_id, cm.module_id;

-- 2. Check existing subscription_modules (should be empty or have some data)
SELECT 
  sm.company_id,
  c.name as company_name,
  sm.module_id,
  sm.is_active,
  sm.monthly_price,
  sm.currency,
  sm.is_trial_module
FROM subscription_modules sm
JOIN companies c ON c.id = sm.company_id
ORDER BY sm.company_id, sm.module_id;

-- 3. Count by module type
SELECT 
  module_id,
  COUNT(*) as companies_using,
  SUM(CASE WHEN enabled THEN 1 ELSE 0 END) as enabled_count
FROM company_modules
GROUP BY module_id
ORDER BY companies_using DESC;

-- ============================================================================
-- AFTER MIGRATION - Verify Results
-- ============================================================================

-- 4. Check subscription_modules after migration
SELECT 
  sm.company_id,
  c.name as company_name,
  c.region,
  sm.module_id,
  sm.is_active,
  sm.monthly_price,
  sm.currency,
  sm.is_trial_module,
  sm.added_at
FROM subscription_modules sm
JOIN companies c ON c.id = sm.company_id
ORDER BY sm.company_id, sm.module_id;

-- 5. Compare counts
SELECT 
  'company_modules (all)' as source,
  COUNT(*) as total_records
FROM company_modules
UNION ALL
SELECT 
  'company_modules (industry only)' as source,
  COUNT(*) as total_records
FROM company_modules
WHERE module_id IN ('tours', 'fleet', 'hotels', 'cafe', 'inventory', 'payroll', 'retail', 'security')
UNION ALL
SELECT 
  'company_modules (core only)' as source,
  COUNT(*) as total_records
FROM company_modules
WHERE module_id IN ('accounting', 'invoicing', 'expenses', 'customers', 'vendors', 'reports')
UNION ALL
SELECT 
  'subscription_modules' as source,
  COUNT(*) as total_records
FROM subscription_modules;

-- 6. Check the unified view
SELECT 
  company_id,
  module_id,
  is_active,
  module_type
FROM company_enabled_modules
ORDER BY company_id, module_type DESC, module_id;

-- 7. Verify all companies have core modules visible
SELECT 
  c.id as company_id,
  c.name as company_name,
  COUNT(cem.module_id) as total_modules,
  COUNT(CASE WHEN cem.module_type = 'core' THEN 1 END) as core_modules,
  COUNT(CASE WHEN cem.module_type = 'industry' THEN 1 END) as industry_modules
FROM companies c
LEFT JOIN company_enabled_modules cem ON cem.company_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- Expected: Each company should have 6 core modules + their industry modules

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- 8. Find any modules that failed to migrate
SELECT 
  cm.company_id,
  cm.module_id,
  cm.enabled,
  'Not migrated' as status
FROM company_modules cm
WHERE 
  cm.module_id IN ('tours', 'fleet', 'hotels', 'cafe', 'inventory', 'payroll', 'retail', 'security')
  AND cm.enabled = true
  AND NOT EXISTS (
    SELECT 1 FROM subscription_modules sm 
    WHERE sm.company_id = cm.company_id 
    AND sm.module_id = cm.module_id
  );

-- Should return 0 rows if migration was successful

-- 9. Check for duplicate entries (shouldn't happen)
SELECT 
  company_id,
  module_id,
  COUNT(*) as duplicate_count
FROM subscription_modules
GROUP BY company_id, module_id
HAVING COUNT(*) > 1;

-- Should return 0 rows

-- ============================================================================
-- ROLLBACK (If needed)
-- ============================================================================

-- If something goes wrong, you can rollback:
-- DELETE FROM subscription_modules WHERE created_at >= '2026-02-17'; -- Adjust date
-- DROP VIEW IF EXISTS company_enabled_modules;
