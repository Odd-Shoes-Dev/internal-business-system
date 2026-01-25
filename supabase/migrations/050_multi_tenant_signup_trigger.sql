-- =====================================================
-- Multi-Tenant Signup Trigger
-- Automatically creates company and links user on signup
-- =====================================================

-- Drop old trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create new multi-tenant signup handler
CREATE OR REPLACE FUNCTION public.handle_new_user_multi_tenant()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
  company_name_value TEXT;
BEGIN
  -- Extract company name from metadata or generate default
  company_name_value := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    split_part(NEW.email, '@', 1) || '''s Company'
  );

  -- Step 1: Create a new company for this user
  INSERT INTO public.companies (
    name,
    subdomain,
    email,
    currency,
    subscription_status,
    trial_ends_at
  ) VALUES (
    company_name_value,
    LOWER(REGEXP_REPLACE(company_name_value, '[^a-zA-Z0-9]', '-', 'g')) || '-' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8),
    NEW.email,
    'USD',  -- Default currency
    'trial',
    NOW() + INTERVAL '14 days'  -- 14-day trial
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

  -- Step 4: Enable default modules for the company
  INSERT INTO public.company_modules (company_id, module_id, enabled)
  VALUES
    (new_company_id, 'accounting', true),
    (new_company_id, 'invoicing', true),
    (new_company_id, 'expenses', true),
    (new_company_id, 'customers', true),
    (new_company_id, 'vendors', true),
    (new_company_id, 'reports', true)
  ON CONFLICT (company_id, module_id) DO NOTHING;

  RAISE NOTICE 'Created company % for user %', new_company_id, NEW.email;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the signup
    RAISE WARNING 'Error in multi-tenant signup: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger with new function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_multi_tenant();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON public.companies TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_companies TO authenticated;
GRANT ALL ON public.company_modules TO authenticated;

COMMENT ON FUNCTION public.handle_new_user_multi_tenant() IS 'Multi-tenant signup: Creates company, user profile, and links them. First user is admin with 14-day trial.';
