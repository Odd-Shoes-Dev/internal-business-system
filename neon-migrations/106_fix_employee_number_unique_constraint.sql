ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_number_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_employee_number_company_unique'
  ) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_employee_number_company_unique UNIQUE (company_id, employee_number);
  END IF;
END $$;
