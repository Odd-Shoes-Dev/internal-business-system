-- Create email_notifications table for tracking sent emails

CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  status TEXT CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_notifications_company ON email_notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_type ON email_notifications(type, sent_at);
CREATE INDEX IF NOT EXISTS idx_email_notifications_recipient ON email_notifications(recipient_email);

-- RLS Policies
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company email notifications"
ON email_notifications
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  )
  OR user_id = auth.uid()
);

-- Comments
COMMENT ON TABLE email_notifications IS 'Log of all emails sent to users';
COMMENT ON COLUMN email_notifications.type IS 'Email type: trial_ending_7_days, payment_failed, invoice_paid, etc.';
