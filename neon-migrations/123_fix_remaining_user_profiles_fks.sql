-- Migration 123: fix every remaining live instance of the user_profiles vs app_users bug
-- (see migration 120 for the full explanation)
--
-- An audit of every column still referencing user_profiles(id) found 28 more, across 24
-- tables, where the application writes the signed-in user's app_users.id - the same failure
-- mode pos_sessions, stock_requisitions, stock_delivery_forms and fiscal_periods had before
-- migrations 120-122. Any user with no matching user_profiles row (anyone who didn't go
-- through onboarding or an invitation) gets a foreign key error doing the matching action:
-- creating or posting a journal entry, an invoice, a payment, a bill, a bill payment, a
-- purchase order, a goods receipt, an expense (including approving, rejecting or paying one),
-- a fixed asset, a cash transaction, a bank reconciliation, a depreciation posting, an
-- inventory transfer request, a stock take, a team invitation, an API key, a tour package,
-- a booking, a petty cash disbursement or replenishment, a payroll period, a payslip, a
-- salary advance, an employee reimbursement, or marking a notification as read.
--
-- A further set of columns have this same bad foreign key but nothing in the app writes to
-- them yet (recurring_transactions, budgets, asset_impairments/revaluations/attachments,
-- vehicle_maintenance, car_rentals, bills.approved_by, inventory_transfers.approved_by/
-- completed_by) or were never a "whoever did this" field to begin with (bank_statements.
-- reconciled_by, cash_accounts.custodian_user_id, inventory_locations.manager_id,
-- employees.user_profile_id, bookings.assigned_guide_id, car_rentals.driver_id,
-- inventory_alerts.resolved_by). None of those are touched here - fix them if and when the
-- feature behind them is actually built.
--
-- NOT VALID, as in 077 and 120-122: existing rows already satisfy this (user_profiles.id was
-- always set equal to the same user's app_users.id), but this skips re-checking them on
-- production.

ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_created_by_fkey;
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_posted_by_fkey;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE payments_received DROP CONSTRAINT IF EXISTS payments_received_created_by_fkey;
ALTER TABLE payments_received ADD CONSTRAINT payments_received_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_created_by_fkey;
ALTER TABLE bills ADD CONSTRAINT bills_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE bill_payments DROP CONSTRAINT IF EXISTS bill_payments_created_by_fkey;
ALTER TABLE bill_payments ADD CONSTRAINT bill_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE goods_receipts DROP CONSTRAINT IF EXISTS goods_receipts_created_by_fkey;
ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_approved_by_fkey;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_rejected_by_fkey;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_paid_by_fkey;
ALTER TABLE expenses ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;
ALTER TABLE expenses ADD CONSTRAINT expenses_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES app_users(id) NOT VALID;
ALTER TABLE expenses ADD CONSTRAINT expenses_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES app_users(id) NOT VALID;
ALTER TABLE expenses ADD CONSTRAINT expenses_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE fixed_assets DROP CONSTRAINT IF EXISTS fixed_assets_created_by_fkey;
ALTER TABLE fixed_assets ADD CONSTRAINT fixed_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_created_by_fkey;
ALTER TABLE cash_transactions ADD CONSTRAINT cash_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE bank_reconciliations DROP CONSTRAINT IF EXISTS bank_reconciliations_created_by_fkey;
ALTER TABLE bank_reconciliations DROP CONSTRAINT IF EXISTS bank_reconciliations_completed_by_fkey;
ALTER TABLE bank_reconciliations ADD CONSTRAINT bank_reconciliations_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;
ALTER TABLE bank_reconciliations ADD CONSTRAINT bank_reconciliations_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE bank_reconciliation_items DROP CONSTRAINT IF EXISTS bank_reconciliation_items_matched_by_fkey;
ALTER TABLE bank_reconciliation_items ADD CONSTRAINT bank_reconciliation_items_matched_by_fkey FOREIGN KEY (matched_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE depreciation_postings DROP CONSTRAINT IF EXISTS depreciation_postings_posted_by_fkey;
ALTER TABLE depreciation_postings ADD CONSTRAINT depreciation_postings_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE inventory_transfers DROP CONSTRAINT IF EXISTS inventory_transfers_requested_by_fkey;
ALTER TABLE inventory_transfers ADD CONSTRAINT inventory_transfers_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE stock_takes DROP CONSTRAINT IF EXISTS stock_takes_counted_by_fkey;
ALTER TABLE stock_takes DROP CONSTRAINT IF EXISTS stock_takes_approved_by_fkey;
ALTER TABLE stock_takes ADD CONSTRAINT stock_takes_counted_by_fkey FOREIGN KEY (counted_by) REFERENCES app_users(id) NOT VALID;
ALTER TABLE stock_takes ADD CONSTRAINT stock_takes_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS user_invitations_invited_by_fkey;
ALTER TABLE user_invitations ADD CONSTRAINT user_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE api_integrations DROP CONSTRAINT IF EXISTS api_integrations_created_by_fkey;
ALTER TABLE api_integrations ADD CONSTRAINT api_integrations_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE tour_packages DROP CONSTRAINT IF EXISTS tour_packages_created_by_fkey;
ALTER TABLE tour_packages ADD CONSTRAINT tour_packages_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_created_by_fkey;
ALTER TABLE bookings ADD CONSTRAINT bookings_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE petty_cash_disbursements DROP CONSTRAINT IF EXISTS petty_cash_disbursements_created_by_fkey;
ALTER TABLE petty_cash_disbursements DROP CONSTRAINT IF EXISTS petty_cash_disbursements_approved_by_fkey;
ALTER TABLE petty_cash_disbursements ADD CONSTRAINT petty_cash_disbursements_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;
ALTER TABLE petty_cash_disbursements ADD CONSTRAINT petty_cash_disbursements_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE petty_cash_replenishments DROP CONSTRAINT IF EXISTS petty_cash_replenishments_created_by_fkey;
ALTER TABLE petty_cash_replenishments ADD CONSTRAINT petty_cash_replenishments_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_processed_by_fkey;
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE payroll_payslips DROP CONSTRAINT IF EXISTS payroll_payslips_created_by_fkey;
ALTER TABLE payroll_payslips ADD CONSTRAINT payroll_payslips_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE salary_advances DROP CONSTRAINT IF EXISTS salary_advances_created_by_fkey;
ALTER TABLE salary_advances ADD CONSTRAINT salary_advances_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE employee_reimbursements DROP CONSTRAINT IF EXISTS employee_reimbursements_created_by_fkey;
ALTER TABLE employee_reimbursements ADD CONSTRAINT employee_reimbursements_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) NOT VALID;

ALTER TABLE notification_reads DROP CONSTRAINT IF EXISTS notification_reads_user_id_fkey;
ALTER TABLE notification_reads ADD CONSTRAINT notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) NOT VALID;

-- Once you have confirmed all rows in a table have matching app_users records, validate it:
-- ALTER TABLE <table> VALIDATE CONSTRAINT <constraint_name>;
