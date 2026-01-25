-- Migration 046: Cafe Module RLS Policies
-- Enable RLS for cafe module tables (if they exist)

-- ============================================================================
-- ENABLE RLS ON CAFE TABLES
-- ============================================================================

DO $$
BEGIN
  -- Enable RLS on cafe tables if they exist
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'menu_categories') THEN
    ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "menu_categories_tenant_isolation_select"
      ON menu_categories FOR SELECT
      USING (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "menu_categories_tenant_isolation_insert"
      ON menu_categories FOR INSERT
      WITH CHECK (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "menu_categories_tenant_isolation_update"
      ON menu_categories FOR UPDATE
      USING (company_id IN (SELECT public.user_companies()))
      WITH CHECK (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "menu_categories_tenant_isolation_delete"
      ON menu_categories FOR DELETE
      USING (company_id IN (SELECT public.user_companies()));
    
    RAISE NOTICE 'RLS enabled for menu_categories';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'menu_items') THEN
    ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "menu_items_tenant_isolation_select"
      ON menu_items FOR SELECT
      USING (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "menu_items_tenant_isolation_insert"
      ON menu_items FOR INSERT
      WITH CHECK (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "menu_items_tenant_isolation_update"
      ON menu_items FOR UPDATE
      USING (company_id IN (SELECT public.user_companies()))
      WITH CHECK (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "menu_items_tenant_isolation_delete"
      ON menu_items FOR DELETE
      USING (company_id IN (SELECT public.user_companies()));
    
    RAISE NOTICE 'RLS enabled for menu_items';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tables') THEN
    ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "tables_tenant_isolation_select"
      ON tables FOR SELECT
      USING (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "tables_tenant_isolation_insert"
      ON tables FOR INSERT
      WITH CHECK (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "tables_tenant_isolation_update"
      ON tables FOR UPDATE
      USING (company_id IN (SELECT public.user_companies()))
      WITH CHECK (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "tables_tenant_isolation_delete"
      ON tables FOR DELETE
      USING (company_id IN (SELECT public.user_companies()));
    
    RAISE NOTICE 'RLS enabled for tables';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'orders') THEN
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "orders_tenant_isolation_select"
      ON orders FOR SELECT
      USING (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "orders_tenant_isolation_insert"
      ON orders FOR INSERT
      WITH CHECK (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "orders_tenant_isolation_update"
      ON orders FOR UPDATE
      USING (company_id IN (SELECT public.user_companies()))
      WITH CHECK (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "orders_tenant_isolation_delete"
      ON orders FOR DELETE
      USING (company_id IN (SELECT public.user_companies()));
    
    RAISE NOTICE 'RLS enabled for orders';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'stock_takes') THEN
    ALTER TABLE stock_takes ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "stock_takes_tenant_isolation_select"
      ON stock_takes FOR SELECT
      USING (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "stock_takes_tenant_isolation_insert"
      ON stock_takes FOR INSERT
      WITH CHECK (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "stock_takes_tenant_isolation_update"
      ON stock_takes FOR UPDATE
      USING (company_id IN (SELECT public.user_companies()))
      WITH CHECK (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "stock_takes_tenant_isolation_delete"
      ON stock_takes FOR DELETE
      USING (company_id IN (SELECT public.user_companies()));
    
    RAISE NOTICE 'RLS enabled for stock_takes';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'salary_advances') THEN
    ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "salary_advances_tenant_isolation_select"
      ON salary_advances FOR SELECT
      USING (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "salary_advances_tenant_isolation_insert"
      ON salary_advances FOR INSERT
      WITH CHECK (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "salary_advances_tenant_isolation_update"
      ON salary_advances FOR UPDATE
      USING (company_id IN (SELECT public.user_companies()))
      WITH CHECK (company_id IN (SELECT public.user_companies()));
    
    CREATE POLICY "salary_advances_tenant_isolation_delete"
      ON salary_advances FOR DELETE
      USING (company_id IN (SELECT public.user_companies()));
    
    RAISE NOTICE 'RLS enabled for salary_advances';
  END IF;
END$$;

