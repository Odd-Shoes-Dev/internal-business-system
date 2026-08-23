ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_number_key;
ALTER TABLE employees ADD CONSTRAINT employees_employee_number_company_unique UNIQUE (company_id, employee_number);
