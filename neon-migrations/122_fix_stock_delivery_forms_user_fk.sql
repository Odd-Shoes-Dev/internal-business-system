-- Migration 122: fix stock_delivery_forms user foreign keys to reference app_users
--
-- stock_delivery_forms.created_by/voided_by have the same user_profiles vs app_users bug
-- fixed by migrations 120 and 121 (see 120 for the full explanation). The code that
-- processes or voids a delivery saves the signed-in user's app_users.id, so a user with no
-- matching user_profiles row gets a foreign key error doing either.
--
-- NOT VALID, as in 077, 120 and 121: existing rows already satisfy this (user_profiles.id
-- was always set equal to the same user's app_users.id), but this skips re-checking them on
-- production.

ALTER TABLE stock_delivery_forms DROP CONSTRAINT IF EXISTS stock_delivery_forms_created_by_fkey;
ALTER TABLE stock_delivery_forms DROP CONSTRAINT IF EXISTS stock_delivery_forms_voided_by_fkey;

ALTER TABLE stock_delivery_forms
  ADD CONSTRAINT stock_delivery_forms_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES app_users(id)
  NOT VALID;

ALTER TABLE stock_delivery_forms
  ADD CONSTRAINT stock_delivery_forms_voided_by_fkey
  FOREIGN KEY (voided_by) REFERENCES app_users(id)
  NOT VALID;

-- Validate once you have confirmed all rows have matching app_users records:
-- ALTER TABLE stock_delivery_forms VALIDATE CONSTRAINT stock_delivery_forms_created_by_fkey;
-- ALTER TABLE stock_delivery_forms VALIDATE CONSTRAINT stock_delivery_forms_voided_by_fkey;
