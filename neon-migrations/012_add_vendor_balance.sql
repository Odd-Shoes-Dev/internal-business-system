-- Add current_balance column to vendors table
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS current_balance DECIMAL(15,2) DEFAULT 0;

-- Update current_balance for existing vendors based on unpaid bills
UPDATE vendors v
SET current_balance = COALESCE((
  SELECT SUM(balance_due)
  FROM bills
  WHERE vendor_id = v.id
  AND status IN ('approved', 'partial', 'overdue')
), 0);
