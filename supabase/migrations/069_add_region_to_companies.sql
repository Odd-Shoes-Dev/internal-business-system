-- Migration 069: Add Region Column to Companies Table
-- This migration adds regional pricing support by storing the company's region

-- Add region column to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'DEFAULT' CHECK (region IN ('AFRICA', 'ASIA', 'EU', 'GB', 'US', 'DEFAULT'));

-- Create index for faster region-based queries
CREATE INDEX IF NOT EXISTS idx_companies_region ON companies(region);

-- Update existing companies based on country
-- This provides reasonable defaults based on current country field
UPDATE companies
SET region = CASE
  WHEN country IN ('Uganda', 'Kenya', 'Tanzania', 'Rwanda', 'South Africa', 'Nigeria', 'Ghana', 'Ethiopia', 'Egypt') THEN 'AFRICA'
  WHEN country IN ('United Kingdom', 'England', 'Scotland', 'Wales', 'Northern Ireland') THEN 'GB'
  WHEN country IN ('Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Switzerland', 'Poland', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland', 'Portugal', 'Greece') THEN 'EU'
  WHEN country IN ('United States', 'USA', 'America') THEN 'US'
  WHEN country IN ('China', 'India', 'Japan', 'South Korea', 'Singapore', 'Malaysia', 'Thailand', 'Vietnam', 'Philippines', 'Indonesia') THEN 'ASIA'
  ELSE 'DEFAULT'
END
WHERE region IS NULL OR region = 'DEFAULT';

COMMENT ON COLUMN companies.region IS 'Geographic region for pricing: AFRICA, ASIA, EU, GB, US, DEFAULT';
