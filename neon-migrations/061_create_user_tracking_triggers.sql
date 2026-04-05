-- Create triggers for user count tracking

-- Function to update user count when users are added/removed
CREATE OR REPLACE FUNCTION update_company_user_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment user count
    UPDATE company_settings
    SET current_user_count = current_user_count + 1,
        updated_at = NOW()
    WHERE company_id = NEW.company_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement user count
    UPDATE company_settings
    SET current_user_count = GREATEST(current_user_count - 1, 0),
        updated_at = NOW()
    WHERE company_id = OLD.company_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user_profiles
DROP TRIGGER IF EXISTS trigger_update_user_count ON user_profiles;
CREATE TRIGGER trigger_update_user_count
AFTER INSERT OR DELETE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_company_user_count();

-- Function to check user limit before adding new user
CREATE OR REPLACE FUNCTION check_company_user_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_current_count INTEGER;
  v_max_allowed INTEGER;
  v_plan_tier TEXT;
BEGIN
  -- Get current user count and limits
  SELECT current_user_count, max_users_allowed, plan_tier
  INTO v_current_count, v_max_allowed, v_plan_tier
  FROM company_settings
  WHERE company_id = NEW.company_id;
  
  -- Enterprise has unlimited users
  IF v_plan_tier = 'enterprise' THEN
    RETURN NEW;
  END IF;
  
  -- Check if adding this user would exceed the limit
  IF v_current_count >= v_max_allowed THEN
    RAISE EXCEPTION 'User limit reached. Your % plan allows % users. Upgrade to add more users.', 
      v_plan_tier, v_max_allowed;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce user limits
DROP TRIGGER IF EXISTS trigger_check_user_limit ON user_profiles;
CREATE TRIGGER trigger_check_user_limit
BEFORE INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION check_company_user_limit();

-- Function to initialize company settings on company creation
CREATE OR REPLACE FUNCTION initialize_company_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO company_settings (
    company_id,
    subscription_status,
    plan_tier,
    billing_period,
    trial_start_date,
    trial_end_date,
    current_user_count,
    max_users_allowed
  ) VALUES (
    NEW.id,
    'trial',
    'professional',
    'monthly',
    NOW(),
    NOW() + INTERVAL '30 days',
    0,
    10
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create company settings
DROP TRIGGER IF EXISTS trigger_initialize_company_settings ON companies;
CREATE TRIGGER trigger_initialize_company_settings
AFTER INSERT ON companies
FOR EACH ROW
EXECUTE FUNCTION initialize_company_settings();

-- Comments
COMMENT ON FUNCTION update_company_user_count IS 'Automatically updates current_user_count when users are added/removed';
COMMENT ON FUNCTION check_company_user_limit IS 'Enforces user limits based on subscription plan';
COMMENT ON FUNCTION initialize_company_settings IS 'Creates company_settings record with trial defaults when company is created';
