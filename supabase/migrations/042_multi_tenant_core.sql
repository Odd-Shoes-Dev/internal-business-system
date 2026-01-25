-- Migration 042: Multi-Tenant Core Tables
-- This migration creates the foundation for multi-tenant architecture
-- WITHOUT breaking existing data

-- ============================================================================
-- COMPANIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Uganda',
  tax_id TEXT,
  registration_number TEXT,
  logo_url TEXT,
  website TEXT,
  
  -- Currency & Accounting
  currency TEXT DEFAULT 'UGX',
  fiscal_year_start TEXT DEFAULT '01-01', -- MM-DD format
  
  -- Subscription Management
  subscription_status TEXT DEFAULT 'trial', -- trial, active, suspended, cancelled
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  subscription_plan TEXT DEFAULT 'starter', -- starter, professional, enterprise
  
  -- Settings (stored as JSON for flexibility)
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_companies_subdomain ON companies(subdomain);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON companies(subscription_status);

-- Update trigger
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();

-- ============================================================================
-- USER-COMPANY RELATIONSHIP TABLE
-- ============================================================================
-- Users can belong to multiple companies with different roles
CREATE TABLE IF NOT EXISTS user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Role in this specific company
  role TEXT DEFAULT 'user', -- admin, accountant, operations, sales, guide, viewer
  
  -- Is this the user's primary/default company?
  is_primary BOOLEAN DEFAULT false,
  
  -- Audit
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: user can only belong to company once
  UNIQUE(user_id, company_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_role ON user_companies(role);

-- ============================================================================
-- COMPANY MODULES TABLE
-- ============================================================================
-- Track which modules/features are enabled for each company
CREATE TABLE IF NOT EXISTS company_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL, -- 'tours', 'cafe', 'fleet', 'hotels', 'retail', 'security', etc.
  enabled BOOLEAN DEFAULT true,
  
  -- Module-specific settings
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  enabled_by UUID REFERENCES auth.users(id),
  
  -- Unique: company can only have one entry per module
  UNIQUE(company_id, module_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_modules_company ON company_modules(company_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_enabled ON company_modules(company_id, enabled);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get all companies a user belongs to
CREATE OR REPLACE FUNCTION get_user_companies(user_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT company_id 
  FROM user_companies
  WHERE user_id = user_uuid;
$$ LANGUAGE SQL STABLE;

-- Function to check if user belongs to a company
CREATE OR REPLACE FUNCTION user_has_company_access(user_uuid UUID, comp_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM user_companies
    WHERE user_id = user_uuid AND company_id = comp_id
  );
$$ LANGUAGE SQL STABLE;

-- Function to get user's role in a company
CREATE OR REPLACE FUNCTION get_user_company_role(user_uuid UUID, comp_id UUID)
RETURNS TEXT AS $$
  SELECT role
  FROM user_companies
  WHERE user_id = user_uuid AND company_id = comp_id;
$$ LANGUAGE SQL STABLE;

-- Function to check if a module is enabled for a company
CREATE OR REPLACE FUNCTION company_has_module(comp_id UUID, mod_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM company_modules
    WHERE company_id = comp_id AND module_id = mod_id AND enabled = true
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE companies IS 'Multi-tenant companies/organizations';
COMMENT ON TABLE user_companies IS 'User-company membership with roles';
COMMENT ON TABLE company_modules IS 'Enabled modules per company';
