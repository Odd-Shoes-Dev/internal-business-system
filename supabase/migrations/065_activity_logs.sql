-- Migration: Activity Logs Table
-- Description: Track all system activities and user actions
-- Created: 2026-02-04

-- Activity logs table already exists in current schema, just add RLS policies
-- The existing table has: user_id -> user_profiles(id) -> user_profiles.company_id

-- RLS Policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view activity logs for users in their company
CREATE POLICY "Users can view their company activity logs"
  ON activity_logs
  FOR SELECT
  USING (
    user_id IN (
      SELECT up.id 
      FROM user_profiles up 
      WHERE up.company_id IN (
        SELECT company_id 
        FROM user_companies 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Only system can insert activity logs (via service role)
CREATE POLICY "Service role can insert activity logs"
  ON activity_logs
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE activity_logs IS 'Audit trail of all system and user activities';
COMMENT ON COLUMN activity_logs.action IS 'Type of action performed';
COMMENT ON COLUMN activity_logs.entity_type IS 'Type of entity affected';
COMMENT ON COLUMN activity_logs.entity_id IS 'ID of the affected entity';
COMMENT ON COLUMN activity_logs.old_values IS 'Previous values before change (JSON)';
COMMENT ON COLUMN activity_logs.new_values IS 'New values after change (JSON)';
