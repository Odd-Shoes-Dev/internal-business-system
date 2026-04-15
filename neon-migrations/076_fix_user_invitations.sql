-- Migration 076: Fix user_invitations to use app_users (not user_profiles)
-- and add revoked_at for soft revocation

-- Drop the old FK constraint that referenced user_profiles
ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS user_invitations_invited_by_fkey;

-- Make invited_by nullable and reference app_users instead
ALTER TABLE user_invitations ALTER COLUMN invited_by DROP NOT NULL;
ALTER TABLE user_invitations
  ADD CONSTRAINT user_invitations_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES app_users(id) ON DELETE SET NULL;

-- Widen role check to match all app_users roles
ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS user_invitations_role_check;
ALTER TABLE user_invitations
  ADD CONSTRAINT user_invitations_role_check
  CHECK (role IN ('admin', 'manager', 'accountant', 'operations', 'sales', 'guide', 'viewer'));

-- Add revoked_at for soft revocation
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;
