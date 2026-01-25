-- Fix invoice RLS policies to allow authenticated users full access
-- This simplifies the policies for development/testing

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Sales and above can create invoices" ON invoices;
DROP POLICY IF EXISTS "Sales can update draft invoices" ON invoices;
DROP POLICY IF EXISTS "Accountants can update all invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can view invoice lines" ON invoice_lines;
DROP POLICY IF EXISTS "Sales and above can manage invoice lines" ON invoice_lines;

-- Create simple policies allowing all authenticated users full access
CREATE POLICY "Authenticated users can do everything with invoices"
  ON invoices
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can do everything with invoice_lines"
  ON invoice_lines
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Also add policies for invoice payments if they exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_payments') THEN
    DROP POLICY IF EXISTS "Authenticated users can view invoice payments" ON invoice_payments;
    CREATE POLICY "Authenticated users can do everything with invoice_payments"
      ON invoice_payments
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
