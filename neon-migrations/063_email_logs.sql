-- Migration: Email Logs Table
-- Description: Track all transactional emails sent by the system
-- Created: 2026-02-04

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email_type VARCHAR(50) NOT NULL, -- trial_reminder, payment_success, payment_failed, welcome, etc.
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  external_id VARCHAR(255), -- Resend email ID
  status VARCHAR(20) NOT NULL DEFAULT 'sent', -- sent, failed, bounced, opened, clicked
  error_message TEXT,
  metadata JSONB, -- Additional data like template variables
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_email_logs_company ON email_logs(company_id);
CREATE INDEX idx_email_logs_type ON email_logs(email_type);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient);

-- RLS Policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their company's email logs
CREATE POLICY "Users can view their company email logs"
  ON email_logs
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Only system can insert email logs (via service role)
CREATE POLICY "Service role can insert email logs"
  ON email_logs
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE email_logs IS 'Audit log of all transactional emails sent by the system';
COMMENT ON COLUMN email_logs.email_type IS 'Type of email: trial_reminder, payment_success, payment_failed, welcome, invoice, etc.';
COMMENT ON COLUMN email_logs.external_id IS 'External email service ID (e.g., Resend email ID)';
COMMENT ON COLUMN email_logs.status IS 'Delivery status: sent, failed, bounced, opened, clicked';
