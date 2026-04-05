-- Migration 069: Add region column for region-aware pricing

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'DEFAULT'
CHECK (region IN ('AFRICA', 'ASIA', 'EU', 'GB', 'US', 'DEFAULT'));

CREATE INDEX IF NOT EXISTS idx_companies_region ON companies(region);

-- Infer region from country where possible.
UPDATE companies
SET region = CASE
  WHEN country IN ('Uganda', 'Kenya', 'Tanzania', 'Rwanda', 'Burundi', 'South Africa', 'Nigeria', 'Ghana', 'Ethiopia', 'Egypt', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Senegal', 'Cameroon', 'Ivory Coast', 'Zimbabwe', 'Zambia', 'Mozambique') THEN 'AFRICA'
  WHEN country IN ('United Kingdom', 'UK', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'Britain', 'Great Britain') THEN 'GB'
  WHEN country IN ('Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Switzerland', 'Poland', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland', 'Portugal', 'Greece', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria') THEN 'EU'
  WHEN country IN ('United States', 'USA', 'US', 'America') THEN 'US'
  WHEN country IN ('India', 'China', 'Japan', 'South Korea', 'Singapore', 'Malaysia', 'Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'Bangladesh', 'Pakistan', 'Sri Lanka') THEN 'ASIA'
  ELSE 'DEFAULT'
END
WHERE region IS NULL OR region = 'DEFAULT';

COMMENT ON COLUMN companies.region IS 'Geographic region for pricing: AFRICA, ASIA, EU, GB, US, DEFAULT';
