-- Migration 124: add the missing created_by column to vehicles
--
-- POST /api/fleet (adding a vehicle) inserts into vehicles(..., mileage, created_by, ...),
-- but the vehicles table (migration 075) has neither a mileage column nor a created_by
-- column - it has current_mileage instead. This is unrelated to the user_profiles/app_users
-- bug fixed elsewhere: it breaks adding a vehicle for every user, not just some, with
-- "column \"mileage\" of relation \"vehicles\" does not exist".
--
-- The accompanying code change (src/app/api/fleet/route.ts) writes the incoming mileage
-- value into the existing current_mileage column instead of a new one. created_by is new,
-- so there is no existing data to reconcile - no NOT VALID needed here.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app_users(id);
