-- Migration 120: fix pos_sessions user foreign keys to reference app_users
--
-- pos_sessions.opened_by/closed_by were created (migration 096) referencing the old
-- user_profiles table, left over from the Supabase-auth era. Sign-in now runs on app_users
-- (see migration 077, which made the same fix for user_companies), and the code that opens
-- a till saves the signed-in user's app_users.id. Any user with no matching user_profiles
-- row - anyone who didn't go through onboarding or an invitation - gets:
--   insert or update on table "pos_sessions" violates foreign key constraint
--   "pos_sessions_opened_by_fkey"
--
-- NOT VALID, as in 077: existing rows already satisfy this (user_profiles.id was always set
-- equal to the same user's app_users.id), but this skips re-checking them on production.

ALTER TABLE pos_sessions DROP CONSTRAINT IF EXISTS pos_sessions_opened_by_fkey;
ALTER TABLE pos_sessions DROP CONSTRAINT IF EXISTS pos_sessions_closed_by_fkey;

ALTER TABLE pos_sessions
  ADD CONSTRAINT pos_sessions_opened_by_fkey
  FOREIGN KEY (opened_by) REFERENCES app_users(id)
  NOT VALID;

ALTER TABLE pos_sessions
  ADD CONSTRAINT pos_sessions_closed_by_fkey
  FOREIGN KEY (closed_by) REFERENCES app_users(id)
  NOT VALID;

-- Validate once you have confirmed all pos_sessions rows have matching app_users records:
-- ALTER TABLE pos_sessions VALIDATE CONSTRAINT pos_sessions_opened_by_fkey;
-- ALTER TABLE pos_sessions VALIDATE CONSTRAINT pos_sessions_closed_by_fkey;
