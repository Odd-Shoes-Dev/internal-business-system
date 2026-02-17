-- Migration 072: Fix Signup Trigger - Remove Company Modules Inserts
-- Core features are always enabled (no table tracking needed)
-- Industry modules tracked in subscription_modules table

CREATE OR REPLACE FUNCTION public.handle_new_user_multi_tenant()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
  company_name_value TEXT;
  company_region TEXT;
  company_country TEXT;
BEGIN 
  -- Extract company name from metadata or generate default
  company_name_value := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    split_part(NEW.email, '@', 1) || '''s Company'
  );

  -- Extract country from metadata (if provided during signup)
  company_country := COALESCE(
    NEW.raw_user_meta_data->>'country',
    'Uganda'
  );

  -- Detect region based on country
  company_region := CASE
    WHEN company_country IN ('Uganda', 'Kenya', 'Tanzania', 'Rwanda', 'Burundi', 'South Africa', 'Nigeria', 'Ghana', 'Ethiopia', 'Egypt', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Senegal', 'Cameroon', 'Ivory Coast', 'Zimbabwe', 'Zambia', 'Mozambique') THEN 'AFRICA'
    WHEN company_country IN ('United Kingdom', 'UK', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'Britain', 'Great Britain') THEN 'GB'
    WHEN company_country IN ('Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Switzerland', 'Poland', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland', 'Portugal', 'Greece', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria') THEN 'EU'
    WHEN company_country IN ('United States', 'USA', 'US', 'America') THEN 'US'
    WHEN company_country IN ('India', 'China', 'Japan', 'South Korea', 'Singapore', 'Malaysia', 'Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'Bangladesh', 'Pakistan', 'Sri Lanka') THEN 'ASIA'
    ELSE 'DEFAULT'
  END;

  -- Step 1: Create a new company for this user
  INSERT INTO public.companies (
    name,
    subdomain,
    email,
    country,
    region,
    currency,
    subscription_status,
    trial_ends_at
  ) VALUES (
    company_name_value,
    LOWER(REGEXP_REPLACE(company_name_value, '[^a-zA-Z0-9]', '-', 'g')) || '-' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8),
    NEW.email,
    company_country,
    company_region,
    'USD',  -- Default currency (can be updated later)
    'trial',
    NOW() + INTERVAL '30 days'  -- 30-day trial
  ) RETURNING id INTO new_company_id;

  -- Step 2: Create user profile
  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    company_id
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'admin',  -- First user is always admin of their company
    true,
    new_company_id
  );

  -- Step 3: Link user to company as admin
  INSERT INTO public.user_companies (
    user_id,
    company_id,
    role,
    is_primary
  ) VALUES (
    NEW.id,
    new_company_id,
    'admin',
    true  -- This is their primary company
  );

  -- Step 4: Core features are always enabled (no module tracking needed)
  -- Optional industry modules will be added via subscription_modules table during signup
  -- after user selects them in the UI

  RAISE NOTICE 'Created company % for user % in region %', new_company_id, NEW.email, company_region;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the signup
    RAISE WARNING 'Error in multi-tenant signup: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user_multi_tenant IS 'Automatically creates company with regional pricing support and links user on signup. Core features always enabled, industry modules in subscription_modules table.';
