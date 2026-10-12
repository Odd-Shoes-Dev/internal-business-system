-- Migration 121: fix the same user_profiles vs app_users foreign key bug as migration 120,
-- on stock_requisitions and fiscal_periods
--
-- stock_requisitions.created_by/closed_by and fiscal_periods.closed_by were created
-- referencing the old user_profiles table, the same issue migration 120 fixed on
-- pos_sessions (see that file for the full explanation). Any user with no matching
-- user_profiles row gets a foreign key error closing/reopening a requisition, or closing a
-- fiscal period.
--
-- NOT VALID, as in 077 and 120: existing rows already satisfy this (user_profiles.id was
-- always set equal to the same user's app_users.id), but this skips re-checking them on
-- production.

ALTER TABLE stock_requisitions DROP CONSTRAINT IF EXISTS stock_requisitions_created_by_fkey;
ALTER TABLE stock_requisitions DROP CONSTRAINT IF EXISTS stock_requisitions_closed_by_fkey;

ALTER TABLE stock_requisitions
  ADD CONSTRAINT stock_requisitions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES app_users(id)
  NOT VALID;

ALTER TABLE stock_requisitions
  ADD CONSTRAINT stock_requisitions_closed_by_fkey
  FOREIGN KEY (closed_by) REFERENCES app_users(id)
  NOT VALID;

ALTER TABLE fiscal_periods DROP CONSTRAINT IF EXISTS fiscal_periods_closed_by_fkey;

ALTER TABLE fiscal_periods
  ADD CONSTRAINT fiscal_periods_closed_by_fkey
  FOREIGN KEY (closed_by) REFERENCES app_users(id)
  NOT VALID;

-- Validate once you have confirmed all rows have matching app_users records:
-- ALTER TABLE stock_requisitions VALIDATE CONSTRAINT stock_requisitions_created_by_fkey;
-- ALTER TABLE stock_requisitions VALIDATE CONSTRAINT stock_requisitions_closed_by_fkey;
-- ALTER TABLE fiscal_periods VALIDATE CONSTRAINT fiscal_periods_closed_by_fkey;
