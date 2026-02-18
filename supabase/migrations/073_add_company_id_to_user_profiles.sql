-- =====================================================
-- Migration 073: Add company_id to user_profiles
-- Required for RLS policies to work correctly
-- =====================================================

-- Add company_id column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_user_profiles_company ON public.user_profiles(company_id);

-- Add comment
COMMENT ON COLUMN public.user_profiles.company_id IS 'Primary company for this user - used for RLS policies';
