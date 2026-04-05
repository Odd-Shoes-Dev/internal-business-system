-- Migration 070: Region-aware multi-tenant signup trigger
-- Replaces single-tenant signup trigger with one that creates company + links user + initializes settings.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user_multi_tenant()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
  company_name_value TEXT;
  company_country TEXT;
  company_region TEXT;
  company_subdomain TEXT;
BEGIN
  company_name_value := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    split_part(COALESCE(NEW.email, 'user@example.com'), '@', 1) || '''s Company'
  );

  company_country := COALESCE(
    NEW.raw_user_meta_data->>'country',
    'Uganda'
  );

  company_region := CASE
    WHEN company_country IN ('Uganda', 'Kenya', 'Tanzania', 'Rwanda', 'Burundi', 'South Africa', 'Nigeria', 'Ghana', 'Ethiopia', 'Egypt', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Senegal', 'Cameroon', 'Ivory Coast', 'Zimbabwe', 'Zambia', 'Mozambique') THEN 'AFRICA'
    WHEN company_country IN ('United Kingdom', 'UK', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'Britain', 'Great Britain') THEN 'GB'
    WHEN company_country IN ('Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Switzerland', 'Poland', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland', 'Portugal', 'Greece', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria') THEN 'EU'
    WHEN company_country IN ('United States', 'USA', 'US', 'America') THEN 'US'
    WHEN company_country IN ('India', 'China', 'Japan', 'South Korea', 'Singapore', 'Malaysia', 'Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'Bangladesh', 'Pakistan', 'Sri Lanka') THEN 'ASIA'
    ELSE 'DEFAULT'
  END;

  company_subdomain := LOWER(REGEXP_REPLACE(company_name_value, '[^a-zA-Z0-9]', '-', 'g')) || '-' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8);

  -- 1) Create company
  INSERT INTO public.companies (
    name,
    subdomain,
    email,
    country,
    region,
    currency,
    subscription_status,
    trial_ends_at,
    subscription_plan
  ) VALUES (
    company_name_value,
    company_subdomain,
    NEW.email,
    company_country,
    company_region,
    'USD',
    'trial',
    NOW() + INTERVAL '30 days',
    'professional'
  ) RETURNING id INTO new_company_id;

  -- 2) Create user profile
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'user@example.com'), '@', 1)),
    'admin',
    true,
    new_company_id
  )
  ON CONFLICT (id) DO UPDATE
  SET company_id = EXCLUDED.company_id,
      role = EXCLUDED.role,
      full_name = COALESCE(user_profiles.full_name, EXCLUDED.full_name);

  -- 3) Link membership
  INSERT INTO public.user_companies (
    user_id,
    company_id,
    role,
    is_primary
  ) VALUES (
    NEW.id,
    new_company_id,
    'admin',
    true
  )
  ON CONFLICT (user_id, company_id) DO NOTHING;

  -- 4) Initialize company settings (required by module quota and billing migrations)
  INSERT INTO public.company_settings (
    company_id,
    name,
    country,
    base_currency,
    subscription_status,
    plan_tier,
    billing_period,
    trial_start_date,
    trial_end_date,
    current_user_count,
    max_users_allowed
  ) VALUES (
    new_company_id,
    company_name_value,
    company_country,
    'USD',
    'trial',
    'professional',
    'monthly',
    NOW(),
    NOW() + INTERVAL '30 days',
    1,
    10
  )
  ON CONFLICT (company_id) DO NOTHING;

  RAISE NOTICE 'Created region-aware company % for user % in region %', new_company_id, NEW.email, company_region;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in multi-tenant signup trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_multi_tenant();

COMMENT ON FUNCTION public.handle_new_user_multi_tenant IS 'Region-aware signup: creates company, user profile, membership, and company settings';
