-- Migration: Add Multi-Currency Support
-- Date: 2025-12-15
-- Description: Add currency support to all documents and customers with exchange rate tracking

-- Step 1: Add currency to customers table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='customers' AND column_name='currency') THEN
    ALTER TABLE customers ADD COLUMN currency CHAR(3) DEFAULT 'USD';
  END IF;
END $$;

-- Set existing customers to USD if currency is null
UPDATE customers SET currency = 'USD' WHERE currency IS NULL;

COMMENT ON COLUMN customers.currency IS 'Preferred currency for customer transactions (USD, EUR, GBP, UGX)';

-- Step 2: Add currency to invoices table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='invoices' AND column_name='currency') THEN
    ALTER TABLE invoices ADD COLUMN currency CHAR(3) DEFAULT 'USD';
  END IF;
END $$;

-- Set existing invoices to USD
UPDATE invoices SET currency = 'USD' WHERE currency IS NULL;

-- Step 3: Add currency to bills table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bills' AND column_name='currency') THEN
    ALTER TABLE bills ADD COLUMN currency CHAR(3) DEFAULT 'USD';
  END IF;
END $$;

-- Set existing bills to USD
UPDATE bills SET currency = 'USD' WHERE currency IS NULL;

-- Step 4: Create exchange_rates table for historical tracking
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency CHAR(3) NOT NULL,
  to_currency CHAR(3) NOT NULL,
  rate DECIMAL(18,8) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(50) DEFAULT 'api',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_rate_per_day UNIQUE(from_currency, to_currency, effective_date)
);

-- Create indexes if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_exchange_rates_currencies') THEN
    CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_exchange_rates_date') THEN
    CREATE INDEX idx_exchange_rates_date ON exchange_rates(effective_date DESC);
  END IF;
END $$;

COMMENT ON TABLE exchange_rates IS 'Historical exchange rates for currency conversion in reports';
COMMENT ON COLUMN exchange_rates.rate IS 'Exchange rate: 1 from_currency = rate to_currency';
COMMENT ON COLUMN exchange_rates.source IS 'Source of rate: api, manual, or provider name';

-- Enable RLS
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exchange_rates
CREATE POLICY "Anyone can view exchange rates"
  ON exchange_rates FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert exchange rates"
  ON exchange_rates FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update exchange rates"
  ON exchange_rates FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Step 5: Insert initial exchange rates (will be updated by API)
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, source) VALUES
  ('USD', 'USD', 1.00000000, CURRENT_DATE, 'manual'),
  ('EUR', 'USD', 1.10000000, CURRENT_DATE, 'manual'),
  ('GBP', 'USD', 1.27000000, CURRENT_DATE, 'manual'),
  ('UGX', 'USD', 0.00027000, CURRENT_DATE, 'manual'),
  ('USD', 'EUR', 0.91000000, CURRENT_DATE, 'manual'),
  ('USD', 'GBP', 0.79000000, CURRENT_DATE, 'manual'),
  ('USD', 'UGX', 3700.00000000, CURRENT_DATE, 'manual')
ON CONFLICT (from_currency, to_currency, effective_date) DO NOTHING;

-- Step 6: Create function to get latest exchange rate
CREATE OR REPLACE FUNCTION get_exchange_rate(
  p_from_currency CHAR(3),
  p_to_currency CHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(18,8) AS $$
DECLARE
  v_rate DECIMAL(18,8);
BEGIN
  -- If same currency, return 1
  IF p_from_currency = p_to_currency THEN
    RETURN 1.00000000;
  END IF;

  -- Get rate for the specified date or most recent before that date
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;

  -- If no rate found, return NULL
  RETURN COALESCE(v_rate, NULL);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_exchange_rate IS 'Get exchange rate for a currency pair on a specific date';

-- Step 7: Create function to convert amount between currencies
CREATE OR REPLACE FUNCTION convert_currency(
  p_amount DECIMAL,
  p_from_currency CHAR(3),
  p_to_currency CHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(18,2) AS $$
DECLARE
  v_rate DECIMAL(18,8);
BEGIN
  -- If same currency, return original amount
  IF p_from_currency = p_to_currency THEN
    RETURN p_amount;
  END IF;

  -- Get exchange rate
  v_rate := get_exchange_rate(p_from_currency, p_to_currency, p_date);

  -- If no rate found, return NULL
  IF v_rate IS NULL THEN
    RETURN NULL;
  END IF;

  -- Convert and return
  RETURN ROUND(p_amount * v_rate, 2);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION convert_currency IS 'Convert an amount from one currency to another using historical rates';

-- Step 8: Add comments to currency columns
COMMENT ON COLUMN invoices.currency IS 'Transaction currency (USD, EUR, GBP, UGX)';
COMMENT ON COLUMN bills.currency IS 'Transaction currency (USD, EUR, GBP, UGX)';
