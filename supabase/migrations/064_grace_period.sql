-- Migration: Add Grace Period and Archival Fields
-- Description: Support grace periods and subscription archival
-- Created: 2026-02-04

-- Add is_archived to subscriptions
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add cancellation reason tracking
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(100);

-- Add index for archived subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_archived 
ON subscriptions(is_archived) 
WHERE is_archived = false;

-- Add index for cancelled/expired subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_cleanup 
ON subscriptions(status, cancelled_at) 
WHERE status IN ('cancelled', 'expired');

COMMENT ON COLUMN subscriptions.is_archived IS 'True if subscription is archived after grace period';
COMMENT ON COLUMN subscriptions.cancellation_reason IS 'Reason for cancellation: user_cancelled, payment_failed, trial_expired, etc.';
