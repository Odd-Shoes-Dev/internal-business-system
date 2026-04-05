-- Migration 023: Core HR + Payroll tables (Neon baseline)
-- Extracted from original migration 020 without client-specific transforms.

-- Payroll frequency enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pay_frequency') THEN
    CREATE TYPE pay_frequency AS ENUM ('weekly', 'biweekly', 'monthly');
  END IF;
END $$;

-- Payroll status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_status') THEN
    CREATE TYPE payroll_status AS ENUM ('draft', 'pending_approval', 'approved', 'paid', 'void');
  END IF;
END $$;

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_number VARCHAR(50) NOT NULL UNIQUE,
  user_profile_id UUID REFERENCES user_profiles(id),
  company_id UUID,

  -- Personal info
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  other_names VARCHAR(100),
  date_of_birth DATE,
  gender VARCHAR(20),
  nationality VARCHAR(100) DEFAULT 'Ugandan',
  national_id VARCHAR(50),

  -- Contact
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(50),

  -- Employment
  job_title VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  employment_type VARCHAR(50) DEFAULT 'full_time',
  hire_date DATE NOT NULL,
  termination_date DATE,
  reporting_to UUID REFERENCES employees(id),

  -- Compensation
  basic_salary DECIMAL(15,2) NOT NULL,
  salary_currency CHAR(3) DEFAULT 'UGX',
  pay_frequency pay_frequency DEFAULT 'monthly',

  -- Bank details
  bank_name VARCHAR(255),
  bank_branch VARCHAR(255),
  bank_account_number VARCHAR(100),
  bank_account_name VARCHAR(255),
  swift_code VARCHAR(20),

  -- Tax info
  tin VARCHAR(50),
  nssf_number VARCHAR(50),

  -- Status
  is_active BOOLEAN DEFAULT true,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_number ON employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);

-- Employee allowances (recurring)
CREATE TABLE IF NOT EXISTS employee_allowances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  allowance_type VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  is_taxable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee deductions (recurring)
CREATE TABLE IF NOT EXISTS employee_deductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  deduction_type VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  is_percentage BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL,
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll periods
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID,
  period_name VARCHAR(100) NOT NULL,
  period_type pay_frequency NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_date DATE NOT NULL,
  status payroll_status DEFAULT 'draft',

  -- Totals
  total_gross DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,
  total_net DECIMAL(15,2) DEFAULT 0,
  total_employer_contributions DECIMAL(15,2) DEFAULT 0,

  processed_by UUID REFERENCES user_profiles(id),
  processed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_payroll_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates ON payroll_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_company_id ON payroll_periods(company_id);

-- Payslips
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payslip_number VARCHAR(50) NOT NULL UNIQUE,
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id),
  employee_id UUID NOT NULL REFERENCES employees(id),

  -- Earnings
  basic_salary DECIMAL(15,2) NOT NULL,
  total_allowances DECIMAL(15,2) DEFAULT 0,
  overtime_hours DECIMAL(10,2) DEFAULT 0,
  overtime_amount DECIMAL(15,2) DEFAULT 0,
  bonus DECIMAL(15,2) DEFAULT 0,
  commission DECIMAL(15,2) DEFAULT 0,
  reimbursements DECIMAL(15,2) DEFAULT 0,
  gross_salary DECIMAL(15,2) NOT NULL,

  -- Deductions
  paye DECIMAL(15,2) DEFAULT 0,
  nssf_employee DECIMAL(15,2) DEFAULT 0,
  loan_deduction DECIMAL(15,2) DEFAULT 0,
  salary_advance DECIMAL(15,2) DEFAULT 0,
  other_deductions DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,

  -- Net pay
  net_salary DECIMAL(15,2) NOT NULL,

  -- Employer contributions
  nssf_employer DECIMAL(15,2) DEFAULT 0,

  -- Payment info
  payment_method payment_method DEFAULT 'bank_transfer',
  payment_reference VARCHAR(100),
  paid_at TIMESTAMPTZ,

  currency CHAR(3) DEFAULT 'UGX',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payslips_period ON payslips(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);

-- Payslip line items
CREATE TABLE IF NOT EXISTS payslip_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payslip_id UUID NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  is_taxable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Salary advances
CREATE TABLE IF NOT EXISTS salary_advances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  company_id UUID,
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL,
  reason TEXT,
  repayment_months INT DEFAULT 1,
  amount_repaid DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  expense_id UUID REFERENCES expenses(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee reimbursements
CREATE TABLE IF NOT EXISTS employee_reimbursements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  company_id UUID,
  reimbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_type VARCHAR(100) NOT NULL,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL,
  receipt_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  paid_in_payroll_id UUID REFERENCES payroll_periods(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
