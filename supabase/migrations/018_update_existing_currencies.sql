-- Update existing records to set default currency where NULL
UPDATE expenses SET currency = 'USD' WHERE currency IS NULL;
UPDATE invoices SET currency = 'USD' WHERE currency IS NULL;
UPDATE bills SET currency = 'USD' WHERE currency IS NULL;
UPDATE customers SET currency = 'USD' WHERE currency IS NULL;
UPDATE vendors SET currency = 'USD' WHERE currency IS NULL;
