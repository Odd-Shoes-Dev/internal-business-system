# BlueOx API Integration System

Complete API system for external integrations with subscription-based access control, rate limiting, and comprehensive monitoring.

## Features

- **Subscription-based API access** - Professional and Enterprise plans only
- **Rate limiting** - Per-plan rate limits with burst protection
- **CORS support** - External domain access with proper headers
- **Real-time monitoring** - Health checks and performance metrics
- **Status transparency** - Public status page for API availability
- **Load testing** - Built-in tools for performance validation
- **Comprehensive logging** - Full request/response audit trail

## API Access Requirements

### Subscription Plans

| Plan | API Access | Rate Limit | Features |
|------|-----------|------------|----------|
| Starter | None | N/A | Core features only |
| Professional | Basic API | 500 req/min | Webhook integration, basic endpoints |
| Enterprise | Full API | 2000 req/min | All endpoints, webhooks, custom integrations |

### Authentication

All API requests require:
- **API Key**: Bearer token authentication
- **System ID**: External system identifier header

```bash
curl -X POST https://your-domain.com/api/integrations/salon/webhook \
  -H "Authorization: Bearer your_api_key" \
  -H "X-Salon-ID: your_salon_id" \
  -H "Content-Type: application/json" \
  -d '{"event": "salon.sale.completed", "data": {...}}'
```

## Quick Start

### 1. Get API Credentials

1. Subscribe to Professional or Enterprise plan
2. Navigate to Settings > API Integration
3. Generate API key and note your system ID

### 2. Test Connection

```bash
# Check API health
curl https://your-domain.com/api/health

# Test webhook endpoint (will return auth error with valid structure)
curl -X POST https://your-domain.com/api/integrations/salon/webhook \
  -H "Authorization: Bearer test_key" \
  -H "X-Salon-ID: test_salon"
```

### 3. Implement Integration

See `/docs/api/API_INTEGRATION_GUIDE.md` for complete integration guide.

## Monitoring & Status

### Public Status Page

Visit `https://your-domain.com/status` to check:
- API endpoint availability
- Response times and performance
- Current system status
- Historical uptime data

### Health Check Endpoint

`GET /api/health` returns:
- Overall system status
- Database connectivity
- Rate limiting system status
- Performance metrics

Example response:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "timestamp": "2026-02-07T10:30:00Z",
  "database": {
    "endpoint": "database",
    "status": "healthy",
    "response_time": 45
  },
  "overall_performance": {
    "avg_response_time": 120,
    "error_rate": 0.1
  }
}
```

## Rate Limiting

### How It Works

- **Sliding window**: 1-minute rolling window
- **Per API key**: Each integration has independent limits
- **Subscription-based**: Limits based on plan tier
- **Burst tolerance**: Short bursts above limit allowed

### Rate Limit Headers

All API responses include rate limit information:
```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487
X-RateLimit-Reset: 1675700400
```

### Handling Rate Limits

When rate limit is exceeded (HTTP 429):
```json
{
  "error": "Rate limit exceeded",
  "limit": 500,
  "reset_time": 1675700400,
  "retry_after": 45
}
```

## Load Testing

### Built-in Load Testing

```bash
# Test health endpoint
npm run test:api

# Test webhook endpoint  
npm run test:api:webhook

# Full load test
npm run test:api:load
```

### Custom Load Testing

```bash
# Test specific endpoint with custom parameters
node scripts/load-test.js --endpoint=webhook --concurrent=20 --requests=200 --export=results.json

# Test production environment
node scripts/load-test.js --endpoint=health --url=https://your-domain.com --concurrent=10 --requests=100
```

### Load Test Results

The load tester provides comprehensive metrics:
- **Performance**: Response times (avg, p50, p95, p99)
- **Throughput**: Requests per second
- **Reliability**: Success/error rates
- **Status codes**: Distribution of response codes
- **Error analysis**: Detailed error reporting

## Security

### Authentication Security

- API keys are unique per integration
- Keys are validated against active subscriptions
- Inactive integrations are automatically blocked

### Rate Limiting Security

- Prevents API abuse and DoS attacks
- Per-key isolation prevents cross-contamination
- Automatic cleanup of old rate limit data

### CORS Security

- Configured for external domain access
- Restricted to necessary headers and methods
- OPTIONS preflight handling

### Data Security

- All API data validated before processing
- Integration logs capture full audit trail
- Row-level security enforces tenant isolation

## Development

### Local Development

```bash
# Start development server
npm run dev

# Run migrations (including API tables)
npm run db:push

# Test API health
npm run api:health
```

### Environment Variables

Required for production:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# API Configuration (optional)
NEXT_PUBLIC_API_RATE_LIMIT_ENABLED=true
API_MONITORING_ENABLED=true
```

### Database Migrations

The API system includes these migrations:
- `062_api_integrations_system.sql` - Core API tables
- `066_rate_limiting_system.sql` - Rate limiting infrastructure

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Check API key format and validity
- Verify system ID header
- Ensure subscription plan supports API access

**429 Rate Limited**
- Reduce request frequency
- Implement exponential backoff
- Consider upgrading subscription plan

**503 Service Unavailable**
- Check status page: `/status`
- Verify health endpoint: `/api/health`
- Contact support if persistent

### Debug Mode

Enable detailed logging by adding request header:
```
X-Debug: true
```

This provides additional context in error responses for debugging.

## Support

- **Documentation**: `/docs`
- **Status Page**: `/status`
- **Health Check**: `/api/health`
- **Email Support**: support@blueox.app

## API Endpoints

### Core Integration Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/integrations/salon/webhook` | POST | Salon transaction webhook | Yes |
| `/api/integrations/reports/financial-summary` | GET | Financial data export | Yes |
| `/api/integrations/api-keys` | GET/POST | API key management | Yes |

### System Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/health` | GET | System health check | No |
| `/status` | GET | Public status page | No |
| `/docs` | GET | Documentation portal | No |

For complete API documentation, see `/docs/api/API_INTEGRATION_GUIDE.md`.