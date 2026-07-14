-- Migration 093: Recalculate invoice amount_paid and status from payment_applications.
-- Fixes invoices stuck on "partial" because their payment was recorded without
-- an invoice_applications link (the receipt POST accepted payment without updating
-- the invoice row).

UPDATE invoices i
SET
  amount_paid = COALESCE(applied.total_applied, 0),
  status = CASE
    WHEN COALESCE(applied.total_applied, 0) <= 0 THEN
      CASE WHEN i.status IN ('void', 'cancelled') THEN i.status ELSE 'sent' END
    WHEN COALESCE(applied.total_applied, 0) >= i.total THEN 'paid'
    ELSE 'partial'
  END,
  updated_at = NOW()
FROM (
  SELECT invoice_id, SUM(amount_applied) AS total_applied
  FROM payment_applications
  GROUP BY invoice_id
) applied
WHERE applied.invoice_id = i.id
  AND (
    -- Only touch invoices whose stored amount_paid differs from the real sum
    ABS(COALESCE(i.amount_paid, 0) - COALESCE(applied.total_applied, 0)) > 0.01
    OR (
      -- Or whose status doesn't match what the math says
      COALESCE(applied.total_applied, 0) >= i.total AND i.status != 'paid'
        AND i.status NOT IN ('void', 'cancelled')
    )
  );
