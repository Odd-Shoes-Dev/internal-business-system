-- Migration 081: Fix get_exchange_rate to fall back to nearest available rate
-- Previously the function returned NULL when no rate existed on or before the
-- transaction date, causing raw foreign-currency amounts to be used as USD.
-- Now it falls back to the earliest available rate so historical records
-- (created before exchange rates were seeded) still convert correctly.

CREATE OR REPLACE FUNCTION get_exchange_rate(
  p_from_currency CHAR(3),
  p_to_currency CHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(18,8) AS $$
DECLARE
  v_rate DECIMAL(18,8);
BEGIN
  IF p_from_currency = p_to_currency THEN
    RETURN 1.00000000;
  END IF;

  -- 1. Prefer a rate on or before the transaction date (historical accuracy)
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;

  -- 2. Fallback: use the earliest available rate (covers historical records
  --    created before exchange rates were seeded)
  IF v_rate IS NULL THEN
    SELECT rate INTO v_rate
    FROM exchange_rates
    WHERE from_currency = p_from_currency
      AND to_currency = p_to_currency
    ORDER BY effective_date ASC
    LIMIT 1;
  END IF;

  RETURN v_rate;
END;
$$ LANGUAGE plpgsql STABLE;
