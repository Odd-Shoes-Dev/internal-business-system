param(
    [string]$NeonUrl,
    [string]$MigrationsDir = "neon-migrations"
)

function Get-EnvValueFromFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Key
    )

    if (-not (Test-Path $Path)) {
        return $null
    }

    $line = Get-Content $Path | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
    if (-not $line) {
        return $null
    }

    return $line.Substring($Key.Length + 1).Trim()
}

if (-not $NeonUrl) {
    $NeonUrl = Get-EnvValueFromFile -Path ".env.local" -Key "NEON_DATABASE_URL"
}

if (-not $NeonUrl) {
    Write-Host "Usage: .\\run-neon-migrations.ps1 -NeonUrl <NEON_CONNECTION_STRING>"
    Write-Host "Or add NEON_DATABASE_URL to .env.local and run without -NeonUrl"
    exit 1
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "Error: psql is not installed or not available in PATH."
    exit 1
}

Write-Host "Starting Neon migrations from $MigrationsDir..."
Write-Host "Connection: [hidden]"
Write-Host "---"

$total = 0
$success = 0
$failed = 0
$skipped = 0

$tempFile = [System.IO.Path]::GetTempFileName()

$compatSql = @"
CREATE SCHEMA IF NOT EXISTS auth;

DO `$`$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END
`$`$;

CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY,
    email text,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb DEFAULT '{}'::jsonb;

ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS `$`$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
`$`$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS `$`$
  SELECT CASE 
    WHEN current_setting('request.jwt.claim.sub', true) IS NOT NULL 
    THEN 'authenticated'
    ELSE 'anon'
  END;
`$`$;
"@

Set-Content -Path $tempFile -Value $compatSql -Encoding UTF8 -NoNewline

& psql $NeonUrl -v ON_ERROR_STOP=1 -f $tempFile -q
$compatExit = $LASTEXITCODE
Remove-Item $tempFile -ErrorAction SilentlyContinue

if ($compatExit -ne 0) {
    Write-Host "Failed to initialize Neon compatibility objects (auth schema/function)."
    exit 1
}

Write-Host "Compatibility objects ready (auth schema + auth.uid())."
Write-Host "---"

$migrationFiles = Get-ChildItem -Path $MigrationsDir -Filter *.sql | Sort-Object Name

foreach ($file in $migrationFiles) {
    $name = $file.Name

    if ($name -match "MIGRATION_GUIDE" -or $name -match "VERIFY_") {
        continue
    }

    if ($name -like "*_storage.sql" -or $name -eq "023_hotel_images.sql") {
        Write-Host "Skipping: $name (Supabase Storage specific)"
        $skipped++
        continue
    }

    Write-Host "Running: $name"
    $total++

    & psql $NeonUrl -v ON_ERROR_STOP=1 -f $file.FullName -q

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK Success"
        $success++
    }
    else {
        Write-Host "  X Failed - fix this file, then re-run"
        $failed++
        Write-Host "Stopping at first failure to make debugging easier."
        break
    }
}

Write-Host "---"
Write-Host "Migration Summary:"
Write-Host "  Total: $total"
Write-Host "  Success: $success"
Write-Host "  Failed: $failed"
Write-Host "  Skipped: $skipped"
Write-Host ""

if ($failed -eq 0) {
    Write-Host "All selected migrations completed successfully!"
    exit 0
}
else {
    Write-Host "Some migrations failed. Review the failing file and re-run."
    exit 1
}
