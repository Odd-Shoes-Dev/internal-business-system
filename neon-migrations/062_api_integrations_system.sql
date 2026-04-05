-- API Integrations System
-- Migration: 050_api_integrations_system.sql
-- Date: February 6, 2026

-- =====================================================
-- CREATE API INTEGRATIONS TABLE
-- =====================================================

CREATE TABLE api_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_name VARCHAR(255) NOT NULL,
  external_system_id VARCHAR(255) NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Authentication
  api_key VARCHAR(255) NOT NULL UNIQUE,
  
  -- Permissions and access control
  permissions TEXT[] DEFAULT '{}', -- e.g., ['read:financial_reports', 'write:transactions']
  allowed_events TEXT[] DEFAULT '{}', -- e.g., ['salon.sale.completed', 'salon.payment.received']
  
  -- Configuration
  description TEXT,
  webhook_url VARCHAR(512),
  rate_limit_per_minute INTEGER DEFAULT 100,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  
  -- Audit
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(external_system_id, company_id)
);

-- =====================================================
-- CREATE INTEGRATION LOGS TABLE
-- =====================================================

CREATE TABLE integration_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID REFERENCES api_integrations(id) ON DELETE CASCADE,
  
  -- Event details
  event_type VARCHAR(100) NOT NULL,
  external_id VARCHAR(255), -- Reference to external system's ID
  
  -- Processing details
  status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  error_message TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  processing_time_ms INTEGER,
  
  -- Request/Response data
  request_data JSONB,
  response_data JSONB,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CREATE SALON TRANSACTIONS TABLE (for reference)
-- =====================================================

CREATE TABLE salon_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- External reference
  external_sale_id VARCHAR(255) NOT NULL,
  external_customer_id VARCHAR(255),
  
  -- Customer details
  customer_name VARCHAR(255) NOT NULL,
  
  -- Financial details
  total_amount DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL,
  currency VARCHAR(3) DEFAULT 'UGX',
  
  -- Services provided
  services JSONB, -- Array of service details
  
  -- Accounting integration
  journal_entry_id UUID REFERENCES journal_entries(id),
  
  -- Timestamps
  transaction_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(company_id, external_sale_id)
);

-- =====================================================
-- CREATE INDEXES
-- =====================================================

-- API Integrations indexes
CREATE INDEX idx_api_integrations_company ON api_integrations(company_id);
CREATE INDEX idx_api_integrations_api_key ON api_integrations(api_key);
CREATE INDEX idx_api_integrations_external_id ON api_integrations(external_system_id);
CREATE INDEX idx_api_integrations_active ON api_integrations(is_active);

-- Integration logs indexes
CREATE INDEX idx_integration_logs_integration ON integration_logs(integration_id);
CREATE INDEX idx_integration_logs_event ON integration_logs(event_type);
CREATE INDEX idx_integration_logs_status ON integration_logs(status);
CREATE INDEX idx_integration_logs_processed_at ON integration_logs(processed_at);
CREATE INDEX idx_integration_logs_external_id ON integration_logs(external_id);

-- Salon transactions indexes
CREATE INDEX idx_salon_transactions_company ON salon_transactions(company_id);
CREATE INDEX idx_salon_transactions_external_sale ON salon_transactions(external_sale_id);
CREATE INDEX idx_salon_transactions_customer ON salon_transactions(external_customer_id);
CREATE INDEX idx_salon_transactions_date ON salon_transactions(transaction_date);
CREATE INDEX idx_salon_transactions_journal ON salon_transactions(journal_entry_id);

-- =====================================================
-- CREATE FUNCTIONS
-- =====================================================

-- Function to update last_used_at timestamp
CREATE OR REPLACE FUNCTION update_integration_last_used()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE api_integrations 
  SET last_used_at = NOW()
  WHERE api_key = NEW.request_data->>'api_key';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old logs (keep only last 90 days)
CREATE OR REPLACE FUNCTION cleanup_integration_logs()
RETURNS VOID AS $$
BEGIN
  DELETE FROM integration_logs
  WHERE created_at < (NOW() - INTERVAL '90 days');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CREATE TRIGGERS
-- =====================================================

-- Update last_used_at when API is called
CREATE TRIGGER trigger_update_integration_last_used
AFTER INSERT ON integration_logs
FOR EACH ROW
EXECUTE FUNCTION update_integration_last_used();

-- Update updated_at timestamp
CREATE TRIGGER trigger_api_integrations_updated_at
BEFORE UPDATE ON api_integrations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_transactions ENABLE ROW LEVEL SECURITY;

-- API Integrations policies
CREATE POLICY "api_integrations_tenant_isolation_select"
  ON api_integrations FOR SELECT
  USING (company_id IN (SELECT public.user_companies()));

CREATE POLICY "api_integrations_admin_only"
  ON api_integrations FOR ALL
  USING (
    company_id IN (SELECT public.user_companies()) 
    AND public.is_admin()
  );

-- Integration logs policies  
CREATE POLICY "integration_logs_tenant_isolation"
  ON integration_logs FOR SELECT
  USING (
    integration_id IN (
      SELECT id FROM api_integrations 
      WHERE company_id IN (SELECT public.user_companies())
    )
  );

-- Salon transactions policies
CREATE POLICY "salon_transactions_tenant_isolation_select"
  ON salon_transactions FOR SELECT
  USING (company_id IN (SELECT public.user_companies()));

CREATE POLICY "salon_transactions_tenant_isolation_insert"
  ON salon_transactions FOR INSERT
  WITH CHECK (company_id IN (SELECT public.user_companies()));

-- =====================================================
-- SEED DATA
-- =====================================================

-- Note: lookup_values table doesn't exist yet, so these are commented out
-- Insert default permission types when lookup_values table is created

/*
INSERT INTO public.lookup_values (type, value, label, description) VALUES 
('api_permission', 'read:financial_reports', 'Read Financial Reports', 'Access to financial summary and reports'),
('api_permission', 'read:customer_data', 'Read Customer Data', 'Access to customer information'),
('api_permission', 'write:transactions', 'Write Transactions', 'Create journal entries and transactions'),
('api_permission', 'read:inventory', 'Read Inventory', 'Access to inventory data'),
('api_permission', 'write:inventory', 'Write Inventory', 'Update inventory levels');

-- Insert default event types
INSERT INTO public.lookup_values (type, value, label, description) VALUES 
('api_event', 'salon.sale.completed', 'Salon Sale Completed', 'Triggered when a salon sale is finalized'),
('api_event', 'salon.payment.received', 'Salon Payment Received', 'Triggered when payment is received'),
('api_event', 'salon.refund.issued', 'Salon Refund Issued', 'Triggered when a refund is processed'),
('api_event', 'salon.appointment.created', 'Salon Appointment Created', 'Triggered when appointment is booked'),
('api_event', 'salon.customer.updated', 'Salon Customer Updated', 'Triggered when customer data changes');
*/

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE api_integrations IS 'External system API integrations and authentication';
COMMENT ON TABLE integration_logs IS 'Log of all API integration events and requests';
COMMENT ON TABLE salon_transactions IS 'Transaction details from integrated salon systems';

COMMENT ON COLUMN api_integrations.api_key IS 'Secure API key for authentication';
COMMENT ON COLUMN api_integrations.permissions IS 'Array of permission strings';
COMMENT ON COLUMN api_integrations.allowed_events IS 'Array of event types this integration can send';
COMMENT ON COLUMN api_integrations.rate_limit_per_minute IS 'Maximum API calls per minute';

-- =====================================================
-- EXAMPLE USAGE
-- =====================================================

/*
-- Create an API key for a salon system:
INSERT INTO api_integrations (
  integration_name,
  external_system_id,
  company_id,
  api_key,
  permissions,
  allowed_events,
  description
) VALUES (
  'Hair Studio POS',
  'hairstudio_001',
  'company-uuid-here',
  'bmp_generated_secure_key_here',
  ARRAY['write:transactions', 'read:financial_reports'],
  ARRAY['salon.sale.completed', 'salon.payment.received'],
  'Integration with Hair Studio POS system'
);
*/