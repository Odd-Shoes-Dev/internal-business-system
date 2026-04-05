#!/bin/bash

# Run Supabase migration files on Neon with compatibility helpers.
# Usage: ./run-neon-migrations.sh "postgresql://user:pass@host/dbname"

if [ -z "$1" ]; then
  echo "Usage: ./run-neon-migrations.sh <NEON_CONNECTION_STRING>"
  echo "Example: ./run-neon-migrations.sh 'postgresql://neondb_owner:npg_xxx@ep-xxx.neon.tech/neondb?sslmode=require'"
  exit 1
fi

NEON_URL="$1"
MIGRATIONS_DIR="supabase/migrations"

echo "Starting Neon migrations from $MIGRATIONS_DIR..."
echo "Connection: [hidden]"
echo "---"

# Counter for tracking
TOTAL=0
SUCCESS=0
FAILED=0
SKIPPED=0

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql is not installed or not available in PATH."
  exit 1
fi

# Compatibility shim for Supabase-specific auth references in migrations.
psql "$NEON_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
SQL

if [ $? -ne 0 ]; then
  echo "Failed to initialize Neon compatibility objects (auth schema/function)."
  exit 1
fi

echo "Compatibility objects ready (auth schema + auth.uid())."
echo "---"

# Run migrations in order
for migration_file in $MIGRATIONS_DIR/*.sql; do
  # Skip non-.sql files and guide files
  if [[ ! "$migration_file" =~ \.sql$ ]] || [[ "$migration_file" == *"MIGRATION_GUIDE"* ]] || [[ "$migration_file" == *"VERIFY_"* ]]; then
    continue
  fi

  # Skip Supabase Storage-only migrations (Neon does not include storage schema).
  if [[ "$migration_file" == *"_storage.sql"* ]] || [[ "$migration_file" == *"hotel_images.sql"* ]]; then
    FILENAME=$(basename "$migration_file")
    echo "Skipping: $FILENAME (Supabase Storage specific)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  FILENAME=$(basename "$migration_file")
  echo "Running: $FILENAME"
  
  TOTAL=$((TOTAL + 1))
  
  # Execute migration
  psql "$NEON_URL" -v ON_ERROR_STOP=1 -f "$migration_file" -q
  
  if [ $? -eq 0 ]; then
    echo "  ✓ Success"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ✗ Failed - fix this file, then re-run"
    FAILED=$((FAILED + 1))
    echo "Stopping at first failure to make debugging easier."
    break
  fi
done

echo "---"
echo "Migration Summary:"
echo "  Total: $TOTAL"
echo "  Success: $SUCCESS"
echo "  Failed: $FAILED"
echo "  Skipped: $SKIPPED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✓ All selected migrations completed successfully!"
  exit 0
else
  echo "Some migrations failed. Review the failing file and re-run."
  exit 1
fi
