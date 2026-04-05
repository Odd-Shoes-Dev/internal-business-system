-- Neon Compatibility Layer
-- Provides Supabase-style auth functions for migrations that reference them
-- This allows us to run Supabase migrations on native PostgreSQL/Neon

CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

-- Create a placeholder auth.users table (no actual auth data; that's in Supabase)
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb DEFAULT '{}'::jsonb;

ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Simulate auth.uid() - returns current user ID from JWT claim or connection variable
-- In production, this will be set by the app via SET LOCAL request.jwt.claim.sub
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Simulate auth.role() - returns 'authenticated' if user is logged in
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('request.jwt.claim.sub', true) IS NOT NULL THEN 'authenticated'
    ELSE 'anon'
  END;
$$;

-- Helper functions for RLS policies (can be overridden in app middleware)
-- These allow migrations to reference auth functions even if RLS isn't used

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.user_role', true), '') = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_accountant_or_above()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.user_role', true), '') IN ('admin', 'accountant');
$$;

CREATE OR REPLACE FUNCTION public.can_view_financials()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.user_role', true), '') IN ('admin', 'accountant', 'operations');
$$;

-- Re-enable extensions if they were disabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
