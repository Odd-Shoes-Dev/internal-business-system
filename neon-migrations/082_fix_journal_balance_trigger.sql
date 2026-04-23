-- Migration 082: Fix journal balance trigger to be deferred
-- The previous AFTER EACH ROW trigger fired after the FIRST journal line
-- was inserted, before the second (balancing) line could be added, causing
-- "Journal entry is not balanced" errors on every multi-line journal entry.
-- A DEFERRABLE INITIALLY DEFERRED constraint trigger only fires at the end
-- of the transaction, when all lines have been inserted.

DROP TRIGGER IF EXISTS validate_journal_balance_trigger ON journal_lines;

CREATE CONSTRAINT TRIGGER validate_journal_balance_trigger
  AFTER INSERT OR UPDATE ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION validate_journal_entry_balance();
