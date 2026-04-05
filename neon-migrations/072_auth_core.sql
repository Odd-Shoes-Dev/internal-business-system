-- Migration 072: Native Neon auth core (replaces Supabase Auth users for app auth)

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'accountant', 'operations', 'sales', 'guide', 'viewer')),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

CREATE OR REPLACE FUNCTION update_app_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_users_updated_at ON app_users;
CREATE TRIGGER app_users_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW
  EXECUTE FUNCTION update_app_users_updated_at();
