-- Migration 077: Fix user_companies FK to reference app_users instead of auth.users
-- The table was originally created referencing Supabase auth.users.
-- Now that we use app_users for authentication, we need to update the FK.

-- Drop the old FK constraint referencing auth.users (if it exists)
ALTER TABLE user_companies DROP CONSTRAINT IF EXISTS user_companies_user_id_fkey;

-- Drop the old invited_by FK referencing auth.users (if it exists)
ALTER TABLE user_companies DROP CONSTRAINT IF EXISTS user_companies_invited_by_fkey;

-- Add new FK referencing app_users with NOT VALID so existing rows are not checked
-- (existing rows may have been seeded before app_users was the auth source)
ALTER TABLE user_companies
  ADD CONSTRAINT user_companies_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
  NOT VALID;

-- Validate only new rows going forward (safe for production with existing data)
-- Uncomment the line below once you have confirmed all user_companies rows
-- have matching app_users records:
-- ALTER TABLE user_companies VALIDATE CONSTRAINT user_companies_user_id_fkey;
