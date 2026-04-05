-- Add subscription and trial tracking columns to company_settings table

-- Trial tracking
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS trial_modules TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP;

-- Subscription status
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial' 
  CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'expired'));

-- Plan details
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'professional'
  CHECK (plan_tier IN ('starter', 'professional', 'enterprise')),
ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly'
  CHECK (billing_period IN ('monthly', 'annual'));

-- Current period tracking
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP;

-- User limits
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS current_user_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_users_allowed INTEGER DEFAULT 10;

-- Stripe integration
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

-- Comments
COMMENT ON COLUMN company_settings.trial_modules IS 'Industry modules selected during 30-day trial (max 3)';
COMMENT ON COLUMN company_settings.subscription_status IS 'Current subscription state: trial, active, past_due, cancelled, expired';
COMMENT ON COLUMN company_settings.plan_tier IS 'Subscription plan: starter, professional, enterprise';
COMMENT ON COLUMN company_settings.current_user_count IS 'Number of active users in the company';
COMMENT ON COLUMN company_settings.max_users_allowed IS 'Maximum users allowed based on plan (3, 10, unlimited)';

