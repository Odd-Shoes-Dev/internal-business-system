-- Migration 044: Migrate Existing Data to Multi-Tenant
-- This migration creates a default company and assigns all existing data to it
-- This preserves all your existing Breco Safaris data

-- ============================================================================
-- CREATE DEFAULT COMPANY (your existing data will go here)
-- ============================================================================

-- Insert default company (you can update details later)
INSERT INTO companies (
  id,
  name,
  subdomain,
  email,
  phone,
  currency,
  subscription_status,
  subscription_plan,
  trial_ends_at
) VALUES (
  gen_random_uuid(),
  'Default Company', -- Change this to your company name
  'default',
  'contact@yourcompany.com', -- Change this
  '+256 XXX XXX XXX', -- Change this
  'UGX',
  'active', -- Set to active (no trial for existing data)
  'professional',
  NULL -- No trial end date
)
ON CONFLICT (subdomain) DO NOTHING -- Prevent duplicate if re-run
RETURNING id;

-- Store the company ID in a variable
DO $$
DECLARE
  default_company_id UUID;
BEGIN
  -- Get the default company ID
  SELECT id INTO default_company_id 
  FROM companies 
  WHERE subdomain = 'default';

  -- If company doesn't exist yet, create it
  IF default_company_id IS NULL THEN
    INSERT INTO companies (
      name, subdomain, email, currency, subscription_status
    ) VALUES (
      'Default Company', 'default', 'contact@yourcompany.com', 'UGX', 'active'
    ) RETURNING id INTO default_company_id;
  END IF;

  -- ============================================================================
  -- UPDATE ALL EXISTING RECORDS WITH company_id
  -- ============================================================================
  
  -- Core tables
  UPDATE user_profiles SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE accounts SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE journal_entries SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE journal_lines SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE fiscal_periods SET company_id = default_company_id WHERE company_id IS NULL;
  
  -- Customers & Vendors
  UPDATE customers SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE vendors SET company_id = default_company_id WHERE company_id IS NULL;
  
  -- Revenue / AR
  UPDATE invoices SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE invoice_lines SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE payments_received SET company_id = default_company_id WHERE company_id IS NULL;
  
  -- Expenses / AP
  UPDATE expenses SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE bills SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE bill_lines SET company_id = default_company_id WHERE company_id IS NULL;
  
  -- Banking
  UPDATE bank_accounts SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE bank_transactions SET company_id = default_company_id WHERE company_id IS NULL;
  
  -- Inventory
  UPDATE products SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE inventory_movements SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE purchase_orders SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE goods_receipts SET company_id = default_company_id WHERE company_id IS NULL;
  
  -- Update stock_takes if table exists
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'stock_takes') THEN
    UPDATE stock_takes SET company_id = default_company_id WHERE company_id IS NULL;
  END IF;
  
  -- Assets
  UPDATE fixed_assets SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE depreciation_entries SET company_id = default_company_id WHERE company_id IS NULL;
  
  -- HR & Payroll
  UPDATE employees SET company_id = default_company_id WHERE company_id IS NULL;
  
  -- Update payroll if table exists
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'payroll') THEN
    UPDATE payroll SET company_id = default_company_id WHERE company_id IS NULL;
  END IF;
  
  -- Update salary_advances if table exists
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'salary_advances') THEN
    UPDATE salary_advances SET company_id = default_company_id WHERE company_id IS NULL;
  END IF;
  
  -- Tour Module
  UPDATE bookings SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE tour_packages SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE destinations SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE hotels SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE vehicles SET company_id = default_company_id WHERE company_id IS NULL;
  -- UPDATE guides SET company_id = default_company_id WHERE company_id IS NULL; -- Table doesn't exist
  
  -- Cafe Module (if exists)
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'menu_categories') THEN
    UPDATE menu_categories SET company_id = default_company_id WHERE company_id IS NULL;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'menu_items') THEN
    UPDATE menu_items SET company_id = default_company_id WHERE company_id IS NULL;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tables') THEN
    UPDATE tables SET company_id = default_company_id WHERE company_id IS NULL;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'orders') THEN
    UPDATE orders SET company_id = default_company_id WHERE company_id IS NULL;
  END IF;

  -- ============================================================================
  -- LINK ALL EXISTING USERS TO DEFAULT COMPANY
  -- ============================================================================
  
  -- Get all existing users and add them to the default company
  INSERT INTO user_companies (user_id, company_id, role, is_primary)
  SELECT 
    id,
    default_company_id,
    COALESCE(raw_user_meta_data->>'role', 'admin'), -- Use existing role or default to admin
    true -- Make it primary company
  FROM auth.users
  WHERE id NOT IN (SELECT user_id FROM user_companies WHERE company_id = default_company_id)
  ON CONFLICT (user_id, company_id) DO NOTHING;

  -- ============================================================================
  -- ENABLE DEFAULT MODULES FOR COMPANY
  -- ============================================================================
  
  -- Enable tour modules (since this was originally a tour system)
  INSERT INTO company_modules (company_id, module_id, enabled) VALUES
    (default_company_id, 'tours', true),
    (default_company_id, 'fleet', true),
    (default_company_id, 'hotels', true)
  ON CONFLICT (company_id, module_id) DO NOTHING;

  RAISE NOTICE 'Migration complete. Default company ID: %', default_company_id;
END$$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if migration was successful
DO $$
DECLARE
  null_company_count INTEGER;
BEGIN
  -- Check for any records still without company_id
  SELECT COUNT(*) INTO null_company_count
  FROM (
    SELECT id FROM customers WHERE company_id IS NULL
    UNION ALL
    SELECT id FROM invoices WHERE company_id IS NULL
    UNION ALL
    SELECT id FROM expenses WHERE company_id IS NULL
    UNION ALL
    SELECT id FROM bookings WHERE company_id IS NULL
  ) as null_records;
  
  IF null_company_count > 0 THEN
    RAISE WARNING 'Found % records still without company_id', null_company_count;
  ELSE
    RAISE NOTICE 'All records successfully assigned to company';
  END IF;
END$$;

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================
-- 
-- After this migration:
-- 1. All existing data is now linked to "Default Company"
-- 2. All existing users are members of this company
-- 3. Tour modules are enabled
-- 4. Next step: Enable RLS policies (migration 045)
-- 5. Update company details via UI or SQL

