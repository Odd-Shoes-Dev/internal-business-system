-- Migration 086: Backfill currency, exchange_rate, base_debit, base_credit
--               on journal_lines that were created before the currency fix.
--
-- Target rows: lines that have an amount (debit > 0 OR credit > 0) but
-- base_debit = 0 AND base_credit = 0, meaning the base amounts were never set.
--
-- For each source_module we join to the relevant source document to get the
-- original currency, then call convert_currency() to get the USD rate and
-- compute the base amounts.
--
-- Safe to re-run: the WHERE clause skips rows that already have base amounts.

-- ============================================================
-- 1. INVOICES  (source_module = 'invoice')
-- ============================================================
UPDATE journal_lines jl
SET currency      = i.currency,
    exchange_rate = COALESCE(convert_currency(1, i.currency, 'USD', je.entry_date::date), 1),
    base_debit    = jl.debit  * COALESCE(convert_currency(1, i.currency, 'USD', je.entry_date::date), 1),
    base_credit   = jl.credit * COALESCE(convert_currency(1, i.currency, 'USD', je.entry_date::date), 1)
FROM journal_entries je
JOIN invoices i ON i.id = je.source_document_id
WHERE jl.journal_entry_id = je.id
  AND je.source_module = 'invoice'
  AND (jl.debit > 0 OR jl.credit > 0)
  AND jl.base_debit  = 0
  AND jl.base_credit = 0;

-- ============================================================
-- 2. INVOICE PAYMENTS  (source_module = 'invoice_payment')
-- ============================================================
UPDATE journal_lines jl
SET currency      = i.currency,
    exchange_rate = COALESCE(convert_currency(1, i.currency, 'USD', je.entry_date::date), 1),
    base_debit    = jl.debit  * COALESCE(convert_currency(1, i.currency, 'USD', je.entry_date::date), 1),
    base_credit   = jl.credit * COALESCE(convert_currency(1, i.currency, 'USD', je.entry_date::date), 1)
FROM journal_entries je
JOIN invoice_payments ip ON ip.id = je.source_document_id
JOIN invoices i ON i.id = ip.invoice_id
WHERE jl.journal_entry_id = je.id
  AND je.source_module = 'invoice_payment'
  AND (jl.debit > 0 OR jl.credit > 0)
  AND jl.base_debit  = 0
  AND jl.base_credit = 0;

-- ============================================================
-- 3. BILLS  (source_module = 'bill')
-- ============================================================
UPDATE journal_lines jl
SET currency      = b.currency,
    exchange_rate = COALESCE(convert_currency(1, b.currency, 'USD', je.entry_date::date), 1),
    base_debit    = jl.debit  * COALESCE(convert_currency(1, b.currency, 'USD', je.entry_date::date), 1),
    base_credit   = jl.credit * COALESCE(convert_currency(1, b.currency, 'USD', je.entry_date::date), 1)
FROM journal_entries je
JOIN bills b ON b.id = je.source_document_id
WHERE jl.journal_entry_id = je.id
  AND je.source_module = 'bill'
  AND (jl.debit > 0 OR jl.credit > 0)
  AND jl.base_debit  = 0
  AND jl.base_credit = 0;

-- ============================================================
-- 4. BILL PAYMENTS  (source_module = 'bill_payment')
--    bill_payments table has its own currency column
-- ============================================================
UPDATE journal_lines jl
SET currency      = bp.currency,
    exchange_rate = COALESCE(convert_currency(1, bp.currency, 'USD', je.entry_date::date), 1),
    base_debit    = jl.debit  * COALESCE(convert_currency(1, bp.currency, 'USD', je.entry_date::date), 1),
    base_credit   = jl.credit * COALESCE(convert_currency(1, bp.currency, 'USD', je.entry_date::date), 1)
FROM journal_entries je
JOIN bill_payments bp ON bp.id = je.source_document_id
WHERE jl.journal_entry_id = je.id
  AND je.source_module = 'bill_payment'
  AND (jl.debit > 0 OR jl.credit > 0)
  AND jl.base_debit  = 0
  AND jl.base_credit = 0;

-- ============================================================
-- 5. EXPENSES  (source_module = 'expense')
-- ============================================================
UPDATE journal_lines jl
SET currency      = e.currency,
    exchange_rate = COALESCE(convert_currency(1, e.currency, 'USD', je.entry_date::date), 1),
    base_debit    = jl.debit  * COALESCE(convert_currency(1, e.currency, 'USD', je.entry_date::date), 1),
    base_credit   = jl.credit * COALESCE(convert_currency(1, e.currency, 'USD', je.entry_date::date), 1)
FROM journal_entries je
JOIN expenses e ON e.id = je.source_document_id
WHERE jl.journal_entry_id = je.id
  AND je.source_module = 'expense'
  AND (jl.debit > 0 OR jl.credit > 0)
  AND jl.base_debit  = 0
  AND jl.base_credit = 0;

-- ============================================================
-- 6. RECEIPTS  (source_module = 'receipt')
--    payments_received has its own currency column
-- ============================================================
UPDATE journal_lines jl
SET currency      = pr.currency,
    exchange_rate = COALESCE(convert_currency(1, pr.currency, 'USD', je.entry_date::date), 1),
    base_debit    = jl.debit  * COALESCE(convert_currency(1, pr.currency, 'USD', je.entry_date::date), 1),
    base_credit   = jl.credit * COALESCE(convert_currency(1, pr.currency, 'USD', je.entry_date::date), 1)
FROM journal_entries je
JOIN payments_received pr ON pr.id = je.source_document_id
WHERE jl.journal_entry_id = je.id
  AND je.source_module = 'receipt'
  AND (jl.debit > 0 OR jl.credit > 0)
  AND jl.base_debit  = 0
  AND jl.base_credit = 0;

-- ============================================================
-- 7. FALLBACK: remaining unprocessed lines (manual entries,
--    unknown modules).  Use USD 1:1 so base = original amount.
-- ============================================================
UPDATE journal_lines jl
SET currency      = COALESCE(NULLIF(jl.currency, ''), 'USD'),
    exchange_rate = 1,
    base_debit    = jl.debit,
    base_credit   = jl.credit
FROM journal_entries je
WHERE jl.journal_entry_id = je.id
  AND (jl.debit > 0 OR jl.credit > 0)
  AND jl.base_debit  = 0
  AND jl.base_credit = 0;

-- ============================================================
-- Report
-- ============================================================
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM journal_lines
  WHERE (debit > 0 OR credit > 0)
    AND base_debit = 0
    AND base_credit = 0;

  IF remaining > 0 THEN
    RAISE WARNING 'backfill_journal_lines_currency: % lines still have base_debit = base_credit = 0 after backfill.', remaining;
  ELSE
    RAISE NOTICE 'backfill_journal_lines_currency: All journal_lines have been backfilled successfully.';
  END IF;
END $$;
