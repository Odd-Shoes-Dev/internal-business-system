-- Fix update_vendor_balance_on_payment trigger function
-- bill_payments table has vendor_id directly, not bill_id
CREATE OR REPLACE FUNCTION update_vendor_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM update_vendor_balance(NEW.vendor_id, -NEW.amount);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
