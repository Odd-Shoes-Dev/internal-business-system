-- Tracks which derived notifications (overdue invoices/bills, requisition activity, etc.)
-- a user has already dismissed, so the unread badge is accurate across devices/browsers.
CREATE TABLE IF NOT EXISTS notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  notification_id VARCHAR(255) NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, company_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user_company
  ON notification_reads (user_id, company_id);
