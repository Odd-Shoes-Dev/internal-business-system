# BlueOx API Health Checks

**Purpose:** Validate all critical API endpoints are responding correctly  
**Frequency:** Every 5 minutes (automated)  
**Total Endpoints:** 45+ critical endpoints

---

## Critical Endpoints Health Check

### Authentication & Core
- [ ] `GET /api/health` - System health status
- [ ] `POST /api/auth/login` - User authentication
- [ ] `GET /api/companies/current` - Company context
- [ ] `GET /api/dashboard/stats` - Dashboard metrics

### Financial APIs (Priority 1)
- [ ] `GET /api/invoices` - Invoice listing
- [ ] `POST /api/invoices` - Create invoice
- [ ] `GET /api/payments` - Payment records
- [ ] `POST /api/receipts` - Payment receipt creation
- [ ] `GET /api/accounts` - Chart of accounts
- [ ] `POST /api/journal-entries` - Journal entry creation
- [ ] `GET /api/exchange-rates/current` - Currency rates

### Operations APIs (Priority 1)  
- [ ] `GET /api/bookings` - Tour bookings
- [ ] `POST /api/bookings` - Create booking
- [ ] `GET /api/tours` - Tour packages
- [ ] `GET /api/hotels` - Hotel listings
- [ ] `GET /api/customers` - Customer management
- [ ] `GET /api/inventory` - Inventory levels

### Billing & Subscriptions (Priority 1)
- [ ] `GET /api/billing/subscription` - Subscription status
- [ ] `POST /api/billing/upgrade` - Subscription upgrades
- [ ] `GET /api/billing/usage` - API usage tracking
- [ ] `POST /api/webhooks/stripe` - Stripe webhook processing

### Reporting APIs (Priority 2)
- [ ] `GET /api/reports/profit-loss` - P&L report generation
- [ ] `GET /api/reports/balance-sheet` - Balance sheet
- [ ] `GET /api/reports/trial-balance` - Trial balance
- [ ] `GET /api/reports/customer-statements` - Customer statements

### Background Jobs (Priority 2)
- [ ] `GET /api/cron/expire-trials` - Trial expiration job
- [ ] `GET /api/cron/dunning` - Payment retry logic
- [ ] `GET /api/cron/cleanup` - Data cleanup routines

---

## Automated Health Check Script

```bash
#!/bin/bash
# File: tests/api/health-checks/run-health-checks.sh

# Configuration
API_BASE="http://localhost:3000"
LOG_FILE="./health-check-$(date +%Y%m%d-%H%M%S).log"
ADMIN_EMAIL="admin@blueoxjobs.eu"

echo "🔍 Starting BlueOx API Health Check - $(date)" | tee $LOG_FILE

# Test authentication and get token
echo "Testing authentication..." | tee -a $LOG_FILE
AUTH_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@company.com","password":"testpass"}')

if [ $? -eq 0 ]; then
  echo "✅ Authentication: PASS" | tee -a $LOG_FILE
  TOKEN=$(echo $AUTH_RESPONSE | jq -r '.token')
else
  echo "❌ Authentication: FAIL" | tee -a $LOG_FILE
  exit 1
fi

# Critical endpoint tests
declare -A endpoints=(
  ["/api/health"]="System Health"
  ["/api/companies/current"]="Company Context"
  ["/api/dashboard/stats"]="Dashboard Stats"
  ["/api/invoices"]="Invoice API"
  ["/api/bookings"]="Booking API"
  ["/api/accounts"]="Chart of Accounts"
  ["/api/billing/subscription"]="Subscription Status"
  ["/api/exchange-rates/current"]="Exchange Rates"
)

PASS_COUNT=0
FAIL_COUNT=0

for endpoint in "${!endpoints[@]}"; do
  description=${endpoints[$endpoint]}
  
  response_code=$(curl -s -o /dev/null -w "%{http_code}" \\
    "$API_BASE$endpoint" \\
    -H "Authorization: Bearer $TOKEN")
  
  if [ "$response_code" = "200" ]; then
    echo "✅ $description: PASS ($response_code)" | tee -a $LOG_FILE
    ((PASS_COUNT++))
  else
    echo "❌ $description: FAIL ($response_code)" | tee -a $LOG_FILE
    ((FAIL_COUNT++))
  fi
  
  sleep 0.5
done

# Summary
echo "\\n📊 HEALTH CHECK SUMMARY:" | tee -a $LOG_FILE
echo "✅ Passed: $PASS_COUNT" | tee -a $LOG_FILE
echo "❌ Failed: $FAIL_COUNT" | tee -a $LOG_FILE
echo "🕐 Completed: $(date)" | tee -a $LOG_FILE

# Alert on failures
if [ $FAIL_COUNT -gt 0 ]; then
  echo "🚨 ALERT: $FAIL_COUNT endpoints failing!" | tee -a $LOG_FILE
  
  # Send alert email (requires mailutils)
  if command -v mail >/dev/null 2>&1; then
    cat $LOG_FILE | mail -s "🚨 BlueOx API Health Check FAILED" $ADMIN_EMAIL
  fi
  
  exit 1
else
  echo "✅ All systems operational" | tee -a $LOG_FILE
  exit 0
fi
```

---

## Detailed Endpoint Testing

### 1. Authentication Flow Test
```javascript
// File: tests/api/health-checks/auth-test.js

const axios = require('axios');

async function testAuthenticationFlow() {
  console.log('🔐 Testing Authentication Flow...');
  
  try {
    // Test login
    const loginResponse = await axios.post('/api/auth/login', {
      email: 'test@company.com',
      password: 'testpass'
    });
    
    if (loginResponse.status !== 200) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const { token } = loginResponse.data;
    
    // Test protected endpoint
    const protectedResponse = await axios.get('/api/companies/current', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (protectedResponse.status !== 200) {
      throw new Error(`Protected endpoint failed: ${protectedResponse.status}`);
    }
    
    console.log('✅ Authentication flow: PASS');
    return { success: true, token };
    
  } catch (error) {
    console.log('❌ Authentication flow: FAIL', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { testAuthenticationFlow };
```

### 2. Database Connectivity Test
```javascript
// File: tests/api/health-checks/database-test.js

const axios = require('axios');

async function testDatabaseConnectivity() {
  console.log('🗄️ Testing Database Connectivity...');
  
  const testQueries = [
    { name: 'Companies Table', endpoint: '/api/companies/current' },
    { name: 'Accounts Table', endpoint: '/api/accounts?limit=1' },
    { name: 'Invoices Table', endpoint: '/api/invoices?limit=1' },
    { name: 'Bookings Table', endpoint: '/api/bookings?limit=1' },
  ];
  
  const results = [];
  
  for (const query of testQueries) {
    try {
      const response = await axios.get(query.endpoint, {
        headers: { Authorization: `Bearer ${process.env.TEST_TOKEN}` }
      });
      
      if (response.status === 200) {
        console.log(`✅ ${query.name}: Connected`);
        results.push({ name: query.name, status: 'pass' });
      } else {
        throw new Error(`Status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ ${query.name}: Failed - ${error.message}`);
      results.push({ name: query.name, status: 'fail', error: error.message });
    }
  }
  
  return results;
}

module.exports = { testDatabaseConnectivity };
```

### 3. Multi-Tenant Isolation Test
```javascript
// File: tests/api/health-checks/multi-tenant-test.js

const axios = require('axios');

async function testMultiTenantIsolation() {
  console.log('🏢 Testing Multi-Tenant Data Isolation...');
  
  // Test with two different company contexts
  const company1Token = await getTokenForCompany('company1@test.com');
  const company2Token = await getTokenForCompany('company2@test.com');
  
  try {
    // Fetch data for company 1
    const company1Data = await axios.get('/api/invoices', {
      headers: { Authorization: `Bearer ${company1Token}` }
    });
    
    // Fetch data for company 2  
    const company2Data = await axios.get('/api/invoices', {
      headers: { Authorization: `Bearer ${company2Token}` }
    });
    
    // Verify no data overlap
    const company1Ids = company1Data.data.map(item => item.id);
    const company2Ids = company2Data.data.map(item => item.id);
    
    const overlap = company1Ids.filter(id => company2Ids.includes(id));
    
    if (overlap.length > 0) {
      throw new Error(`Data isolation breach: ${overlap.length} overlapping records`);
    }
    
    console.log('✅ Multi-tenant isolation: PASS');
    return { success: true };
    
  } catch (error) {
    console.log('❌ Multi-tenant isolation: FAIL', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { testMultiTenantIsolation };
```

### 4. Payment Integration Test
```javascript
// File: tests/api/health-checks/payment-test.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');

async function testPaymentIntegration() {
  console.log('💳 Testing Payment Integration...');
  
  try {
    // Test Stripe connection
    const account = await stripe.accounts.retrieve();
    console.log('✅ Stripe connection: PASS');
    
    // Test webhook endpoint
    const webhookResponse = await axios.post('/api/webhooks/stripe', {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test',
          status: 'active'
        }
      }
    }, {
      headers: {
        'stripe-signature': 'test_signature'
      }
    });
    
    console.log('✅ Webhook processing: PASS');
    
    return { success: true };
    
  } catch (error) {
    console.log('❌ Payment integration: FAIL', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { testPaymentIntegration };
```

---

## Critical Metrics to Monitor

### Response Time Thresholds
- **Authentication:** < 500ms
- **Data Retrieval:** < 1000ms  
- **Data Creation:** < 2000ms
- **Report Generation:** < 10000ms

### Success Rate Thresholds  
- **API Endpoints:** > 99.5% success rate
- **Database Queries:** > 99.9% success rate
- **Payment Processing:** > 99.0% success rate

### Concurrent User Limits
- **Concurrent Sessions:** 100+ users per tenant
- **API Requests:** 1000+ req/min per tenant
- **Database Connections:** 50+ concurrent per tenant

---

## Alert Conditions

### 🟡 Warning Level
- Response time > 2x normal
- Success rate < 98%
- Single endpoint down < 5 minutes

### 🔴 Critical Level  
- Multiple endpoints down
- Database connectivity lost
- Authentication system down
- Payment processing failed
- Success rate < 95%

---

## Manual Health Check Procedure

When automated checks fail, follow this manual verification:

### 1. Quick System Status (2 minutes)
```bash
# Check if server is running
curl -I http://localhost:3000/api/health

# Check database connection
curl http://localhost:3000/api/companies/current \\
  -H "Authorization: Bearer $TEST_TOKEN"

# Check critical functionality
curl http://localhost:3000/api/invoices?limit=1 \\
  -H "Authorization: Bearer $TEST_TOKEN"
```

### 2. Component-by-Component Check (10 minutes)
- [ ] Web server (Next.js) responding
- [ ] Database (Supabase) connectivity  
- [ ] Authentication service working
- [ ] External APIs accessible (Stripe, email)
- [ ] File storage accessible
- [ ] Background jobs running

### 3. User Flow Simulation (20 minutes)
- [ ] User can log in
- [ ] Dashboard loads correctly
- [ ] Create new record (invoice/booking)
- [ ] Generate and view report
- [ ] Process a payment
- [ ] Send an email notification

---

## Recovery Procedures

### 1. Service Restart
```bash
# Restart the application
pm2 restart blueox-app

# Check restart success
curl -I http://localhost:3000/api/health
```

### 2. Database Recovery
```bash
# Check database status
npx supabase status

# Restart database if needed  
npx supabase stop
npx supabase start
```

### 3. Cache Clear
```bash
# Clear Next.js cache
rm -rf .next/cache

# Restart with fresh cache
npm run build
npm run start
```

---

## Logs and Monitoring

### Log Locations
- **Application Logs:** `/var/log/blueox/app.log`
- **Database Logs:** Access via Supabase Dashboard
- **Health Check Logs:** `./tests/api/health-checks/logs/`
- **Error Logs:** `/var/log/blueox/error.log`

### Key Metrics Dashboard
Monitor these metrics in your observability platform:

- API response times (average & 95th percentile)
- Error rates by endpoint
- Database query performance
- Active user sessions
- System resource usage (CPU, memory, disk)
- Payment transaction success rates

---

**Last Updated:** February 7, 2026  
**Next Review:** Weekly (Sundays)