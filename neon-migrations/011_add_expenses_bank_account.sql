-- Add missing columns to expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id),
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS reference VARCHAR(100);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_bank_account ON expenses(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_customer ON expenses(customer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- Add comments
COMMENT ON COLUMN expenses.bank_account_id IS 'Bank account used for payment';
COMMENT ON COLUMN expenses.customer_id IS 'Customer for billable expenses';
COMMENT ON COLUMN expenses.status IS 'Expense status: pending, approved, paid, rejected';
COMMENT ON COLUMN expenses.reference IS 'Expense reference number';
