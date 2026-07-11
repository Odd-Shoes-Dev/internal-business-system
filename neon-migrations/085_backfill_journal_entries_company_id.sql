-- Migration 085: Backfill company_id on journal_entries where it is NULL
--
-- Journal entries were created without company_id before the fix in the
-- application code. This migration resolves company_id from the source
-- document for each known source_module, then falls back to a best-effort
-- approach for any remaining NULL rows.
--
-- Safe to run multiple times (only touches rows WHERE company_id IS NULL).

-- ============================================================
-- 1. INVOICES  (source_module = 'invoice')
--    source_document_id → invoices.id → invoices.company_id
-- ============================================================
UPDATE journal_entries je
SET company_id = inv.company_id
FROM invoices inv
WHERE je.company_id IS NULL
  AND je.source_module = 'invoice'
  AND je.source_document_id = inv.id;

-- ============================================================
-- 2. INVOICE PAYMENTS  (source_module = 'invoice_payment')
--    source_document_id → invoice_payments.id → invoice_payments.invoice_id
--    → invoices.company_id
--    (invoice_payments table was created in migration 084; any entries
--     created before that migration will be matched here once rows exist)
-- ============================================================
UPDATE journal_entries je
SET company_id = inv.company_id
FROM invoice_payments ip
JOIN invoices inv ON inv.id = ip.invoice_id
WHERE je.company_id IS NULL
  AND je.source_module = 'invoice_payment'
  AND je.source_document_id = ip.id;

-- ============================================================
-- 3. BILLS  (source_module = 'bill')
--    source_document_id → bills.id → bills.company_id
-- ============================================================
UPDATE journal_entries je
SET company_id = bill.company_id
FROM bills bill
WHERE je.company_id IS NULL
  AND je.source_module = 'bill'
  AND je.source_document_id = bill.id;

-- ============================================================
-- 4. BILL PAYMENTS  (source_module = 'bill_payment')
--    source_document_id → bill_payments.id → bill_payments.vendor_id
--    → vendors.company_id
-- ============================================================
UPDATE journal_entries je
SET company_id = v.company_id
FROM bill_payments bp
JOIN vendors v ON v.id = bp.vendor_id
WHERE je.company_id IS NULL
  AND je.source_module = 'bill_payment'
  AND je.source_document_id = bp.id;

-- ============================================================
-- 5. EXPENSES  (source_module = 'expense')
--    source_document_id → expenses.id → expenses.company_id
-- ============================================================
UPDATE journal_entries je
SET company_id = exp.company_id
FROM expenses exp
WHERE je.company_id IS NULL
  AND je.source_module = 'expense'
  AND je.source_document_id = exp.id;

-- ============================================================
-- 6. RECEIPTS  (source_module = 'receipt')
--    source_document_id → payments_received.id → payments_received.customer_id
--    → customers.company_id
--    (payments_received has no company_id column; company comes from customer)
-- ============================================================
UPDATE journal_entries je
SET company_id = c.company_id
FROM payments_received pr
JOIN customers c ON c.id = pr.customer_id
WHERE je.company_id IS NULL
  AND je.source_module = 'receipt'
  AND je.source_document_id = pr.id;

-- ============================================================
-- 7. FALLBACK: any remaining NULL rows (manual entries, unknown modules)
--    Assign to the single company on the account if only one company
--    is linked to that account via journal_lines.
-- ============================================================
UPDATE journal_entries je
SET company_id = sub.company_id
FROM (
  SELECT jl.journal_entry_id, a.company_id
  FROM journal_lines jl
  JOIN accounts a ON a.id = jl.account_id
  WHERE a.company_id IS NOT NULL
  GROUP BY jl.journal_entry_id, a.company_id
  HAVING COUNT(DISTINCT a.company_id) = 1
) sub
WHERE je.company_id IS NULL
  AND je.id = sub.journal_entry_id;

-- ============================================================
-- Report: show any rows still unresolved after all passes
-- ============================================================
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining FROM journal_entries WHERE company_id IS NULL;
  IF remaining > 0 THEN
    RAISE WARNING 'backfill_journal_entries_company_id: % journal_entries still have NULL company_id after backfill. These are likely manual entries with no linked accounts — review and assign manually.', remaining;
  ELSE
    RAISE NOTICE 'backfill_journal_entries_company_id: All journal_entries now have a company_id.';
  END IF;
END $$;
