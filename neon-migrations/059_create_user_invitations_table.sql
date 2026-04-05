-- Create user_invitations table for team member invitations

CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'accountant', 'viewer')),
  token TEXT UNIQUE NOT NULL,
  invited_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_invitations_company ON user_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires ON user_invitations(expires_at);

-- RLS Policies
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations for their company"
ON user_invitations
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM user_profiles WHERE id = auth.uid()
));

CREATE POLICY "Admins can create invitations"
ON user_invitations
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Comments
COMMENT ON TABLE user_invitations IS 'Team member invitation tracking';
COMMENT ON COLUMN user_invitations.token IS 'Unique token for invitation link';
COMMENT ON COLUMN user_invitations.expires_at IS 'Invitation expires after 7 days';
