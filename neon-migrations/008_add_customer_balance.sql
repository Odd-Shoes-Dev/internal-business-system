-- Add current_balance column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS current_balance DECIMAL(15,2) DEFAULT 0.00;

-- Add comment
COMMENT ON COLUMN customers.current_balance IS 'Running balance of customer receivables';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_balance ON customers(current_balance) WHERE current_balance != 0;
