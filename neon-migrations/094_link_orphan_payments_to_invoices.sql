-- Migration 094: Link orphan payments to their invoices and fix status.
--
-- Payments recorded without invoice_applications leave invoices stuck on
-- "partial". This migration finds payments_received rows that have no
-- payment_applications entry and links them to an unpaid invoice for the
-- same customer where the payment amount covers the outstanding balance.
-- Only inserts a link when the match is unambiguous (exactly one candidate
-- invoice per payment).

WITH unlinked_payments AS (
  -- Payments that have no payment_applications at all
  SELECT pr.id AS payment_id,
         pr.customer_id,
         pr.amount,
         pr.company_id
  FROM payments_received pr
  WHERE NOT EXISTS (
    SELECT 1 FROM payment_applications pa WHERE pa.payment_id = pr.id
  )
),
candidate_invoices AS (
  -- Unpaid/partial invoices that match the payment's customer and amount
  SELECT i.id   AS invoice_id,
         i.customer_id,
         i.company_id,
         i.total - COALESCE(i.amount_paid, 0) AS balance
  FROM invoices i
  WHERE i.status NOT IN ('paid', 'void', 'cancelled')
),
matches AS (
  SELECT up.payment_id,
         ci.invoice_id,
         up.amount,
         -- Only take matches where exactly one invoice exists for this payment
         COUNT(ci.invoice_id) OVER (PARTITION BY up.payment_id) AS match_count
  FROM unlinked_payments up
  JOIN candidate_invoices ci
    ON ci.customer_id  = up.customer_id
   AND ci.company_id   = up.company_id
   AND ABS(ci.balance - up.amount) < 0.01   -- amount covers the balance
),
unambiguous AS (
  SELECT payment_id, invoice_id, amount
  FROM matches
  WHERE match_count = 1
),
inserted AS (
  INSERT INTO payment_applications (payment_id, invoice_id, amount_applied)
  SELECT payment_id, invoice_id, amount
  FROM unambiguous
  ON CONFLICT DO NOTHING
  RETURNING invoice_id, amount_applied
)
UPDATE invoices i
SET
  amount_paid = COALESCE(i.amount_paid, 0) + ins.amount_applied,
  status      = CASE
                  WHEN COALESCE(i.amount_paid, 0) + ins.amount_applied >= i.total THEN 'paid'::invoice_status
                  ELSE 'partial'::invoice_status
                END,
  updated_at  = NOW()
FROM inserted ins
WHERE ins.invoice_id = i.id;
