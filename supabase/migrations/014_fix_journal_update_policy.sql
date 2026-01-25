-- =====================================================
-- FIX JOURNAL ENTRIES UPDATE POLICY
-- Allow posting draft entries
-- =====================================================

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Accountants can update draft journals" ON journal_entries;

-- Create new policy that allows:
-- 1. Updating draft entries (keeping them as drafts or posting them)
-- 2. Voiding posted entries
CREATE POLICY "Accountants can update journals appropriately"
  ON journal_entries FOR UPDATE
  USING (
    is_accountant_or_above() AND 
    (
      -- Can update drafts
      status = 'draft' OR
      -- Can void posted entries (will be changed to 'void' status)
      status = 'posted'
    )
  )
  WITH CHECK (
    is_accountant_or_above() AND
    (
      -- Can keep as draft
      status = 'draft' OR
      -- Can change to posted
      status = 'posted' OR
      -- Can change to void
      status = 'void'
    )
  );
