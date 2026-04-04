-- Migration 074: Fix trial_end_date sync between companies and company_settings
-- 
-- ROOT CAUSE:
--   1. companies.trial_ends_at is set correctly at signup (NOW() + 30 days at INSERT time)
--   2. company_settings.trial_end_date is a separate field that was supposed to mirror it
--   3. Migration 061 added an initialize_company_settings() trigger, but that trigger
--      used its own NOW() + 30 days instead of reading NEW.trial_ends_at from the companies row
--   4. Companies created BEFORE migration 061 had no company_settings row at all;
--      the billing API lazily created it using the wrong date when first visited
--
-- This migration:
--   A) Fixes the trigger to always derive trial_end_date from companies.trial_ends_at
--   B) One-time UPDATE to correct all existing mismatched company_settings rows

-- ============================================================================
-- A: Fix initialize_company_settings trigger to use companies.trial_ends_at
-- ============================================================================

CREATE OR REPLACE FUNCTION initialize_company_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO company_settings (
    company_id,
    subscription_status,
    plan_tier,
    billing_period,
    trial_start_date,
    trial_end_date,
    current_user_count,
    max_users_allowed
  ) VALUES (
    NEW.id,
    COALESCE(NEW.subscription_status, 'trial'),
    'professional',
    'monthly',
    NOW(),
    -- Use the authoritative trial_ends_at from the companies row, not a new NOW() + 30d
    COALESCE(NEW.trial_ends_at, NOW() + INTERVAL '30 days'),
    0,
    10
  )
  ON CONFLICT (company_id) DO UPDATE SET
    -- If a row already exists, keep it but sync the trial dates from companies
    trial_end_date = COALESCE(NEW.trial_ends_at, company_settings.trial_end_date),
    subscription_status = COALESCE(NEW.subscription_status, company_settings.subscription_status);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- B: One-time data fix — update all existing company_settings rows where
--    trial_end_date doesn't match companies.trial_ends_at
-- ============================================================================

UPDATE company_settings cs
SET trial_end_date = c.trial_ends_at
FROM companies c
WHERE cs.company_id = c.id
  AND c.trial_ends_at IS NOT NULL
  AND (
    -- Missing trial_end_date
    cs.trial_end_date IS NULL
    OR
    -- trial_end_date is more than 1 day off from the company's authoritative date
    ABS(EXTRACT(EPOCH FROM (cs.trial_end_date - c.trial_ends_at))) > 86400
  );

-- Also sync subscription_status where company_settings has a stale value
UPDATE company_settings cs
SET subscription_status = c.subscription_status
FROM companies c
WHERE cs.company_id = c.id
  AND c.subscription_status IS NOT NULL
  AND cs.subscription_status != c.subscription_status;

-- ============================================================================
-- Verify the fix
-- ============================================================================

DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM company_settings cs
  JOIN companies c ON cs.company_id = c.id
  WHERE c.trial_ends_at IS NOT NULL
    AND cs.trial_end_date IS NOT NULL
    AND ABS(EXTRACT(EPOCH FROM (cs.trial_end_date - c.trial_ends_at))) > 86400;

  IF mismatch_count > 0 THEN
    RAISE WARNING 'After migration 074, % company_settings rows still have mismatched trial_end_date', mismatch_count;
  ELSE
    RAISE NOTICE 'Migration 074 complete: all company_settings.trial_end_date values now match companies.trial_ends_at';
  END IF;
END;
$$;
