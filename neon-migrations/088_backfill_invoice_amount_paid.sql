-- Backfill amount_paid for invoices already marked as 'paid' but where amount_paid was never set
UPDATE invoices
SET amount_paid = total
WHERE status = 'paid'
  AND (amount_paid IS NULL OR amount_paid = 0)
  AND total > 0;
