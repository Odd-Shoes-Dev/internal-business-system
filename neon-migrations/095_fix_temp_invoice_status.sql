-- Migration 095: Directly mark fully-receipted invoices as paid.
-- TEMP-1783961375428 has a corresponding receipt (REC-2026-00001) showing
-- full payment but the invoice row was never updated because they were
-- created as separate unlinked documents.

UPDATE invoices
SET
  amount_paid = total,
  status      = 'paid'::invoice_status,
  updated_at  = NOW()
WHERE invoice_number = 'TEMP-1783961375428'
  AND status NOT IN ('void', 'cancelled');
