-- Migration 099: Allow nullable customer_id for POS walk-in sales
-- POS transactions don't require a known customer.

ALTER TABLE invoices
  ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE payments_received
  ALTER COLUMN customer_id DROP NOT NULL;
