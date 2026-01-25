-- Fix expenses RLS policies to allow authenticated users full access

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Users can create expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses" ON expenses;

-- Create simple policies allowing all authenticated users full access
CREATE POLICY "Authenticated users can do everything with expenses"
  ON expenses
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
