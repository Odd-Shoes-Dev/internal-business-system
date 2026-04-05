-- Migration: Add Multiple Email Addresses to Customers
-- Date: 2025-12-15
-- Description: Allow customers to have up to 4 email addresses for invoice delivery

-- Add additional email columns to customers table
ALTER TABLE customers
ADD COLUMN email_2 VARCHAR(255),
ADD COLUMN email_3 VARCHAR(255),
ADD COLUMN email_4 VARCHAR(255);

-- Add comments for clarity
COMMENT ON COLUMN customers.email IS 'Primary email address';
COMMENT ON COLUMN customers.email_2 IS 'Secondary email address (optional)';
COMMENT ON COLUMN customers.email_3 IS 'Tertiary email address (optional)';
COMMENT ON COLUMN customers.email_4 IS 'Fourth email address (optional)';

-- Add check constraints to ensure valid email format (optional but recommended)
ALTER TABLE customers
ADD CONSTRAINT email_2_format CHECK (email_2 IS NULL OR email_2 ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
ADD CONSTRAINT email_3_format CHECK (email_3 IS NULL OR email_3 ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
ADD CONSTRAINT email_4_format CHECK (email_4 IS NULL OR email_4 ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
