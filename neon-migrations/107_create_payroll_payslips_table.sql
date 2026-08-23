-- Create payroll_payslips table used by the payroll generate/process API
CREATE TABLE IF NOT EXISTS payroll_payslips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),

  -- Earnings
  basic_salary NUMERIC(15,2) DEFAULT 0,
  allowances NUMERIC(15,2) DEFAULT 0,
  housing_allowance NUMERIC(15,2) DEFAULT 0,
  transport_allowance NUMERIC(15,2) DEFAULT 0,
  other_allowances NUMERIC(15,2) DEFAULT 0,
  gross_salary NUMERIC(15,2) DEFAULT 0,

  -- Deductions
  deductions NUMERIC(15,2) DEFAULT 0,
  tax_deduction NUMERIC(15,2) DEFAULT 0,
  nhif_deduction NUMERIC(15,2) DEFAULT 0,
  nssf_deduction NUMERIC(15,2) DEFAULT 0,
  nssf_employee NUMERIC(15,2) DEFAULT 0,
  nssf_employer NUMERIC(15,2) DEFAULT 0,
  loan_deduction NUMERIC(15,2) DEFAULT 0,
  advance_deduction NUMERIC(15,2) DEFAULT 0,

  -- Net pay
  net_salary NUMERIC(15,2) DEFAULT 0,

  -- Attendance
  days_worked NUMERIC(6,2),

  -- Status
  status VARCHAR(20) DEFAULT 'pending',

  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_payslips_period ON payroll_payslips(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payslips_employee ON payroll_payslips(employee_id);
