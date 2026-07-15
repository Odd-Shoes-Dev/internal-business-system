-- Migration 097: Add 'pos' and 'payroll' to subscription_modules allowed values
-- The CHECK constraint on module_id must be dropped and recreated to add new modules.

ALTER TABLE subscription_modules
  DROP CONSTRAINT IF EXISTS subscription_modules_module_id_check;

ALTER TABLE subscription_modules
  ADD CONSTRAINT subscription_modules_module_id_check
  CHECK (module_id IN (
    'tours',
    'fleet',
    'hotels',
    'cafe',
    'security',
    'inventory',
    'payroll',
    'retail',
    'pos'
  ));
