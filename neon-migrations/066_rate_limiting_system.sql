-- Rate Limiting System for API Routes
-- Migration: 066_rate_limiting_system.sql  
-- Date: February 7, 2026

-- =====================================================
-- CREATE RATE LIMIT TRACKING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_limit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key VARCHAR(255) NOT NULL,
  timestamp BIGINT NOT NULL,
  endpoint VARCHAR(255) DEFAULT 'api_generic',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for rate limit lookups (most important)
CREATE INDEX IF NOT EXISTS idx_rate_limit_api_key_timestamp 
ON rate_limit_requests(api_key, timestamp);

-- Index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_rate_limit_timestamp 
ON rate_limit_requests(timestamp);

-- Index for endpoint analytics
CREATE INDEX IF NOT EXISTS idx_rate_limit_endpoint 
ON rate_limit_requests(endpoint, timestamp);

-- =====================================================
-- CREATE CLEANUP FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_records()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete records older than 24 hours
  DELETE FROM rate_limit_requests 
  WHERE timestamp < EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000;
END;
$$;

-- =====================================================
-- CREATE RATE LIMIT STATS VIEW
-- =====================================================

CREATE OR REPLACE VIEW rate_limit_stats AS
SELECT 
  api_key,
  endpoint,
  COUNT(*) as request_count,
  MIN(timestamp) as first_request,
  MAX(timestamp) as last_request,
  DATE_TRUNC('hour', TO_TIMESTAMP(timestamp/1000)) as hour_bucket
FROM rate_limit_requests 
WHERE timestamp > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000
GROUP BY api_key, endpoint, hour_bucket
ORDER BY hour_bucket DESC, request_count DESC;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant access to authenticated users for rate limiting
GRANT SELECT, INSERT, DELETE ON rate_limit_requests TO authenticated;
GRANT SELECT ON rate_limit_stats TO authenticated;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS (but allow all operations since this is system-level data)
ALTER TABLE rate_limit_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage rate limit data
CREATE POLICY "Allow authenticated rate limit operations"
ON rate_limit_requests
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE rate_limit_requests IS 'Tracks API requests for rate limiting purposes';
COMMENT ON COLUMN rate_limit_requests.api_key IS 'API key making the request';
COMMENT ON COLUMN rate_limit_requests.timestamp IS 'Unix timestamp in milliseconds';
COMMENT ON COLUMN rate_limit_requests.endpoint IS 'API endpoint being accessed';
COMMENT ON COLUMN rate_limit_requests.ip_address IS 'Client IP address';
COMMENT ON COLUMN rate_limit_requests.user_agent IS 'Client user agent';

COMMENT ON VIEW rate_limit_stats IS 'Hourly stats for API rate limiting analysis';