-- Migration 043: Add company links required by SaaS migrations
-- Adds company_id to user_profiles so policies in later migrations can resolve tenant context.

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);

-- Backfill from user_companies when possible.
UPDATE user_profiles up
SET company_id = uc.company_id
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    company_id
  FROM user_companies
  ORDER BY user_id, is_primary DESC, joined_at ASC
) uc
WHERE up.id = uc.user_id
  AND up.company_id IS NULL;

COMMENT ON COLUMN user_profiles.company_id IS 'Primary company for fast tenant scoping in policies and joins';

-- Add deferred company foreign keys for HR/payroll tables created before companies.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'company_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_company_id_fkey'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payroll_periods' AND column_name = 'company_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_periods_company_id_fkey'
  ) THEN
    ALTER TABLE payroll_periods
      ADD CONSTRAINT payroll_periods_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'salary_advances' AND column_name = 'company_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salary_advances_company_id_fkey'
  ) THEN
    ALTER TABLE salary_advances
      ADD CONSTRAINT salary_advances_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employee_reimbursements' AND column_name = 'company_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_reimbursements_company_id_fkey'
  ) THEN
    ALTER TABLE employee_reimbursements
      ADD CONSTRAINT employee_reimbursements_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;
