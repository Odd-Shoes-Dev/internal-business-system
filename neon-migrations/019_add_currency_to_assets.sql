-- Add currency column to fixed_assets table
ALTER TABLE fixed_assets 
ADD COLUMN currency VARCHAR(3) DEFAULT 'USD';

-- Update existing records to have USD as currency
UPDATE fixed_assets 
SET currency = 'USD' 
WHERE currency IS NULL;

-- Add comment to the column
COMMENT ON COLUMN fixed_assets.currency IS 'Currency code (USD, EUR, GBP, UGX)';
