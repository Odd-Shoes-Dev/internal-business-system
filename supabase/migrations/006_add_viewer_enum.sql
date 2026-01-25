
-- Add `viewer` to user_role enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'viewer'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'viewer';
  END IF;
END;
$$;
