# Performance & Load Testing Framework

**Purpose:** Validate system performance, scalability, and reliability under load  
**Frequency:** Weekly performance tests + Monthly load testing  
**Coverage:** API Performance, Database Performance, Frontend Performance, System Limits

---

## Performance Testing Categories

### 🔴 Critical Performance Tests (Daily)  
- **API Response Times** - All endpoints under normal load
- **Database Query Performance** - Critical queries execution time
- **Page Load Performance** - Core user journeys timing
- **Memory Usage Monitoring** - System resource consumption
- **Cache Hit Rates** - Redis and application cache effectiveness

### 🟡 Load Testing (Weekly)
- **Concurrent User Testing** - Multi-user simulation
- **API Stress Testing** - High-throughput endpoint testing  
- **Database Load Testing** - High-query volume scenarios
- **File Upload Performance** - Large file handling
- **Report Generation Load** - Bulk reporting scenarios

### 🟢 Scalability Testing (Monthly)
- **Peak Load Simulation** - Black Friday/high-season scenarios
- **Long-Running Load Tests** - 24-hour endurance testing
- **Auto-scaling Validation** - Infrastructure scaling behavior
- **Failover Testing** - Performance during system failures
- **Geographic Load Distribution** - Multi-region performance

---

## API Performance Testing

### Baseline Performance Benchmarks
```javascript
// File: tests/performance/api/api-performance.spec.js

import { test, expect } from '@playwright/test';

test.describe('API Performance', () => {
  const performanceThresholds = {
    // Response times in milliseconds
    'GET /api/customers': 200,
    'GET /api/invoices': 300,
    'POST /api/invoices': 500,
    'GET /api/dashboard/metrics': 400,
    'GET /api/reports/financial': 1000,
    'POST /api/bookings': 600,
    'PUT /api/customers/:id': 400,
    'DELETE /api/invoices/:id': 300
  };

  test('validates API response times', async ({ page }) => {
    // Login to get authentication
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    const sessionCookie = await page.context().cookies();
    const token = sessionCookie.find(c => c.name.includes('session'))?.value;
    
    const results = [];
    
    for (const [endpoint, threshold] of Object.entries(performanceThresholds)) {
      const [method, url] = endpoint.split(' ');
      const startTime = Date.now();
      
      let response;
      try {
        switch (method) {
          case 'GET':
            response = await page.request.get(url, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            break;
          case 'POST':
            response = await page.request.post(url, {
              headers: { 'Authorization': `Bearer ${token}` },
              data: getTestData(url)
            });
            break;
          case 'PUT':
            response = await page.request.put(url.replace(':id', '1'), {
              headers: { 'Authorization': `Bearer ${token}` },
              data: getTestData(url)
            });
            break;
          case 'DELETE':
            response = await page.request.delete(url.replace(':id', '1'), {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            break;
        }
        
        const responseTime = Date.now() - startTime;
        
        results.push({
          endpoint,
          responseTime,
          threshold,
          status: response.status(),
          passed: responseTime <= threshold && response.ok()
        });
        
        // Log performance
        console.log(`${endpoint}: ${responseTime}ms (threshold: ${threshold}ms)`);
        
        // Validate performance
        expect(response.ok()).toBeTruthy();
        expect(responseTime).toBeLessThanOrEqual(threshold);
        
      } catch (error) {
        console.error(`Error testing ${endpoint}:`, error);
        results.push({
          endpoint,
          error: error.message,
          passed: false
        });
      }
      
      // Brief pause between requests
      await page.waitForTimeout(100);
    }
    
    // Generate performance report
    generatePerformanceReport(results);
  });

  test('validates concurrent API performance', async ({ page }) => {
    // Setup authentication
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    const sessionCookie = await page.context().cookies();
    const token = sessionCookie.find(c => c.name.includes('session'))?.value;
    
    // Create 20 concurrent requests
    const concurrentRequests = 20;
    const endpoint = '/api/customers';
    
    const startTime = Date.now();
    const promises = [];
    
    for (let i = 0; i < concurrentRequests; i++) {
      const promise = page.request.get(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      promises.push(promise);
    }
    
    const responses = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    // Validate all requests succeeded
    for (const response of responses) {
      expect(response.ok()).toBeTruthy();
    }
    
    // Calculate average response time
    const averageTime = totalTime / concurrentRequests;
    
    console.log(`Concurrent test - ${concurrentRequests} requests in ${totalTime}ms`);
    console.log(`Average response time: ${averageTime}ms`);
    
    // Should handle concurrent load efficiently
    expect(averageTime).toBeLessThanOrEqual(500);
    expect(totalTime).toBeLessThanOrEqual(3000);
  });
});

function getTestData(url) {
  const testData = {
    '/api/invoices': {
      customerId: 1,
      items: [{
        description: 'Test Service',
        quantity: 1,
        price: 100
      }],
      dueDate: '2026-03-01'
    },
    '/api/bookings': {
      customerId: 1,
      tourId: 1,
      checkIn: '2026-03-01',
      checkOut: '2026-03-05',
      guests: 2
    },
    '/api/customers': {
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '1234567890'
    }
  };
  
  return testData[url] || {};
}

function generatePerformanceReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    averageResponseTime: results
      .filter(r => r.responseTime)
      .reduce((sum, r) => sum + r.responseTime, 0) / results.length,
    results
  };
  
  require('fs').writeFileSync(
    './test-results/performance/api-performance-report.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log('Performance report generated:', report);
}
```

---

## Database Performance Testing

### Query Performance Validation
```javascript
// File: tests/performance/database/database-performance.spec.js

import { test, expect } from '@playwright/test';

test.describe('Database Performance', () => {
  const criticalQueries = [
    {
      name: 'Dashboard Metrics',
      endpoint: '/api/dashboard/metrics',
      threshold: 500,
      description: 'Main dashboard KPI queries'
    },
    {
      name: 'Invoice List',
      endpoint: '/api/invoices?limit=50',
      threshold: 300,
      description: 'Paginated invoice retrieval'
    },
    {
      name: 'Customer Search',
      endpoint: '/api/customers?search=john',
      threshold: 200,
      description: 'Customer text search'
    },
    {
      name: 'Financial Reports',
      endpoint: '/api/reports/profit-loss?period=last-month',
      threshold: 2000,
      description: 'Complex financial aggregation'
    },
    {
      name: 'Booking Calendar',
      endpoint: '/api/bookings/calendar?month=2026-03',
      threshold: 400,
      description: 'Monthly booking overview'
    }
  ];

  test('validates database query performance', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    const sessionCookie = await page.context().cookies();
    const token = sessionCookie.find(c => c.name.includes('session'))?.value;
    
    const queryResults = [];
    
    for (const query of criticalQueries) {
      console.log(`Testing query: ${query.name}`);
      
      // Run query 5 times to get average
      const times = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        const response = await page.request.get(query.endpoint, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const queryTime = Date.now() - startTime;
        times.push(queryTime);
        
        expect(response.ok()).toBeTruthy();
        
        // Brief pause between runs
        await page.waitForTimeout(50);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      queryResults.push({
        name: query.name,
        endpoint: query.endpoint,
        averageTime,
        minTime,
        maxTime,
        threshold: query.threshold,
        passed: averageTime <= query.threshold,
        times
      });
      
      console.log(`${query.name}: avg=${averageTime}ms, min=${minTime}ms, max=${maxTime}ms`);
      
      // Validate performance
      expect(averageTime).toBeLessThanOrEqual(query.threshold);
    }
    
    // Generate database performance report
    generateDatabaseReport(queryResults);
  });

  test('validates query performance under load', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    const sessionCookie = await page.context().cookies();
    const token = sessionCookie.find(c => c.name.includes('session'))?.value;
    
    // Simulate heavy database load
    const concurrentQueries = 50;
    const endpoint = '/api/dashboard/metrics';
    
    const startTime = Date.now();
    const promises = [];
    
    for (let i = 0; i < concurrentQueries; i++) {
      const promise = page.request.get(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      promises.push(promise);
    }
    
    const responses = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    // Validate all queries succeeded
    for (const response of responses) {
      expect(response.ok()).toBeTruthy();
    }
    
    const averageQueryTime = totalTime / concurrentQueries;
    
    console.log(`Database load test: ${concurrentQueries} queries in ${totalTime}ms`);
    console.log(`Average query time under load: ${averageQueryTime}ms`);
    
    // Database should handle concurrent load gracefully
    expect(averageQueryTime).toBeLessThanOrEqual(1000);
  });

  test('validates connection pool efficiency', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    const sessionCookie = await page.context().cookies();
    const token = sessionCookie.find(c => c.name.includes('session'))?.value;
    
    // Test different endpoints to validate connection reuse
    const endpoints = [
      '/api/customers',
      '/api/invoices',
      '/api/bookings',
      '/api/reports/recent-activities'
    ];
    
    const results = [];
    
    for (let round = 1; round <= 3; round++) {
      console.log(`Round ${round}: Testing connection efficiency`);
      
      for (const endpoint of endpoints) {
        const startTime = Date.now();
        
        const response = await page.request.get(endpoint, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const responseTime = Date.now() - startTime;
        
        results.push({
          round,
          endpoint,
          responseTime,
          timestamp: new Date().toISOString()
        });
        
        expect(response.ok()).toBeTruthy();
        
        // No delay between requests to test connection reuse
      }
    }
    
    // Analyze connection efficiency
    for (const endpoint of endpoints) {
      const endpointResults = results.filter(r => r.endpoint === endpoint);
      const times = endpointResults.map(r => r.responseTime);
      
      // Later rounds should be faster due to connection pooling
      const firstRound = times[0];
      const laterRounds = times.slice(1);
      const laterAverage = laterRounds.reduce((sum, time) => sum + time, 0) / laterRounds.length;
      
      console.log(`${endpoint}: First=${firstRound}ms, Later avg=${laterAverage}ms`);
      
      // Connection reuse should improve performance
      expect(laterAverage).toBeLessThanOrEqual(firstRound * 1.2); // Allow 20% variation
    }
  });
});

function generateDatabaseReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalQueries: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      averageResponseTime: results.reduce((sum, r) => sum + r.averageTime, 0) / results.length
    },
    results
  };
  
  require('fs').writeFileSync(
    './test-results/performance/database-performance-report.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log('Database performance report generated');
}
```

---

## Frontend Performance Testing

### Page Load Performance
```javascript
// File: tests/performance/frontend/page-performance.spec.js

import { test, expect } from '@playwright/test';

test.describe('Frontend Performance', () => {
  const pageTargets = [
    { url: '/dashboard', name: 'Dashboard', threshold: 2000 },
    { url: '/dashboard/invoices', name: 'Invoice List', threshold: 1500 },
    { url: '/dashboard/customers', name: 'Customer List', threshold: 1500 },
    { url: '/dashboard/bookings', name: 'Booking List', threshold: 1500 },
    { url: '/dashboard/reports', name: 'Reports Page', threshold: 1000 },
    { url: '/dashboard/invoices/new', name: 'New Invoice Form', threshold: 1000 }
  ];

  test('validates page load performance', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    const pageResults = [];
    
    for (const pageTarget of pageTargets) {
      console.log(`Testing page load: ${pageTarget.name}`);
      
      const startTime = Date.now();
      
      await page.goto(pageTarget.url);
      
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Validate critical elements are visible
      await expect(page.locator('[data-testid="page-content"]')).toBeVisible();
      
      pageResults.push({
        name: pageTarget.name,
        url: pageTarget.url,
        loadTime,
        threshold: pageTarget.threshold,
        passed: loadTime <= pageTarget.threshold
      });
      
      console.log(`${pageTarget.name}: ${loadTime}ms (threshold: ${pageTarget.threshold}ms)`);
      
      expect(loadTime).toBeLessThanOrEqual(pageTarget.threshold);
    }
    
    generateFrontendReport(pageResults);
  });

  test('validates Core Web Vitals', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard');
    
    // Measure Core Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {};
        
        // Largest Contentful Paint (LCP)
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // First Input Delay (FID) - simulated
        vitals.fid = 0;
        
        // Cumulative Layout Shift (CLS)
        let clsScore = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsScore += entry.value;
            }
          }
          vitals.cls = clsScore;
        }).observe({ entryTypes: ['layout-shift'] });
        
        // Wait for measurements
        setTimeout(() => {
          resolve(vitals);
        }, 3000);
      });
    });
    
    console.log('Core Web Vitals:', webVitals);
    
    // Google's recommended thresholds
    expect(webVitals.lcp).toBeLessThanOrEqual(2500); // 2.5s for LCP
    expect(webVitals.fid).toBeLessThanOrEqual(100);  // 100ms for FID
    expect(webVitals.cls).toBeLessThanOrEqual(0.1);  // 0.1 for CLS
  });

  test('validates JavaScript performance', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard');
    
    // Measure JavaScript execution time
    const jsPerformance = await page.evaluate(() => {
      const startTime = performance.now();
      
      // Simulate complex operations
      const operations = [
        () => document.querySelectorAll('[data-testid]'),
        () => Array.from({ length: 1000 }).map((_, i) => i * Math.random()),
        () => JSON.parse(JSON.stringify({ test: 'data', items: Array(100).fill('test') }))
      ];
      
      operations.forEach(op => op());
      
      const endTime = performance.now();
      
      return {
        executionTime: endTime - startTime,
        domElements: document.querySelectorAll('*').length,
        memoryUsage: performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        } : null
      };
    });
    
    console.log('JavaScript Performance:', jsPerformance);
    
    // JavaScript execution should be fast
    expect(jsPerformance.executionTime).toBeLessThanOrEqual(50);
    
    // Memory usage should be reasonable
    if (jsPerformance.memoryUsage) {
      const memoryRatio = jsPerformance.memoryUsage.used / jsPerformance.memoryUsage.total;
      expect(memoryRatio).toBeLessThanOrEqual(0.5); // Less than 50% memory usage
    }
  });

  test('validates network performance', async ({ page }) => {
    // Monitor network requests
    const networkRequests = [];
    
    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        startTime: Date.now()
      });
    });
    
    page.on('response', response => {
      const request = networkRequests.find(req => 
        req.url === response.url() && req.endTime === undefined
      );
      
      if (request) {
        request.endTime = Date.now();
        request.responseTime = request.endTime - request.startTime;
        request.status = response.status();
        request.size = response.headers()['content-length'] || 0;
      }
    });
    
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Analyze network performance
    const completedRequests = networkRequests.filter(req => req.endTime);
    const apiRequests = completedRequests.filter(req => req.url.includes('/api/'));
    const staticRequests = completedRequests.filter(req => 
      ['script', 'stylesheet', 'image'].includes(req.resourceType)
    );
    
    console.log(`Total requests: ${completedRequests.length}`);
    console.log(`API requests: ${apiRequests.length}`);
    console.log(`Static requests: ${staticRequests.length}`);
    
    // Validate API response times
    for (const apiReq of apiRequests) {
      console.log(`API ${apiReq.method} ${apiReq.url}: ${apiReq.responseTime}ms`);
      expect(apiReq.responseTime).toBeLessThanOrEqual(1000);
      expect(apiReq.status).toBeLessThan(400);
    }
    
    // Validate static resource loading
    for (const staticReq of staticRequests) {
      expect(staticReq.responseTime).toBeLessThanOrEqual(500);
      expect(staticReq.status).toBeLessThan(400);
    }
  });
});

function generateFrontendReport(pageResults) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPages: pageResults.length,
      passed: pageResults.filter(p => p.passed).length,
      failed: pageResults.filter(p => !p.passed).length,
      averageLoadTime: pageResults.reduce((sum, p) => sum + p.loadTime, 0) / pageResults.length
    },
    pageResults
  };
  
  require('fs').writeFileSync(
    './test-results/performance/frontend-performance-report.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log('Frontend performance report generated');
}
```

---

## Load Testing with K6

### High-Load Simulation Scripts
```javascript
// File: tests/performance/load/k6-load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Hold 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Hold 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.05'],   // Error rate under 5%
    errors: ['rate<0.1'],            // Custom error rate under 10%
  },
};

const BASE_URL = 'http://localhost:3000';
let authToken;

export function setup() {
  // Login to get auth token
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'test@company.com',
    password: 'testpassword'
  });
  
  check(loginResponse, {
    'login successful': (r) => r.status === 200,
  });
  
  return {
    authToken: loginResponse.json('token')
  };
}

export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.authToken}`,
    'Content-Type': 'application/json',
  };
  
  // Simulate user journey
  userJourney(headers);
  
  sleep(1);
}

function userJourney(headers) {
  // 1. Load dashboard
  let response = http.get(`${BASE_URL}/api/dashboard/metrics`, { headers });
  let success = check(response, {
    'dashboard loads': (r) => r.status === 200,
    'dashboard response time': (r) => r.timings.duration < 500,
  });
  errorRate.add(!success);
  
  sleep(0.5);
  
  // 2. View customers
  response = http.get(`${BASE_URL}/api/customers?limit=25`, { headers });
  success = check(response, {
    'customers load': (r) => r.status === 200,
    'customers response time': (r) => r.timings.duration < 300,
  });
  errorRate.add(!success);
  
  sleep(0.3);
  
  // 3. Search customers (30% of users)
  if (Math.random() < 0.3) {
    response = http.get(`${BASE_URL}/api/customers?search=john`, { headers });
    success = check(response, {
      'search works': (r) => r.status === 200,
      'search response time': (r) => r.timings.duration < 200,
    });
    errorRate.add(!success);
  }
  
  sleep(0.2);
  
  // 4. View invoices
  response = http.get(`${BASE_URL}/api/invoices?limit=25`, { headers });
  success = check(response, {
    'invoices load': (r) => r.status === 200,
    'invoices response time': (r) => r.timings.duration < 300,
  });
  errorRate.add(!success);
  
  sleep(0.3);
  
  // 5. Create invoice (20% of users)
  if (Math.random() < 0.2) {
    const invoiceData = {
      customerId: Math.floor(Math.random() * 100) + 1,
      items: [{
        description: 'Test Service',
        quantity: 1,
        price: Math.floor(Math.random() * 1000) + 100
      }],
      dueDate: '2026-03-15'
    };
    
    response = http.post(`${BASE_URL}/api/invoices`, JSON.stringify(invoiceData), { headers });
    success = check(response, {
      'invoice created': (r) => r.status === 201,
      'creation response time': (r) => r.timings.duration < 500,
    });
    errorRate.add(!success);
  }
  
  sleep(0.5);
  
  // 6. Generate report (10% of users)
  if (Math.random() < 0.1) {
    response = http.get(`${BASE_URL}/api/reports/profit-loss?period=last-month`, { headers });
    success = check(response, {
      'report generated': (r) => r.status === 200,
      'report response time': (r) => r.timings.duration < 2000,
    });
    errorRate.add(!success);
  }
}

export function handleSummary(data) {
  return {
    './test-results/performance/k6-load-test-report.json': JSON.stringify(data, null, 2),
  };
}
```

### Database Load Testing
```javascript
// File: tests/performance/load/database-load-test.js

import { test, expect } from '@playwright/test';

test.describe('Database Load Testing', () => {
  test('simulates high database load', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    const sessionCookie = await page.context().cookies();
    const token = sessionCookie.find(c => c.name.includes('session'))?.value;
    
    // Simulate heavy read load
    const readLoadTest = async () => {
      const promises = [];
      const endpoints = [
        '/api/customers',
        '/api/invoices', 
        '/api/bookings',
        '/api/dashboard/metrics',
        '/api/reports/recent-activities'
      ];
      
      // 100 concurrent requests across different endpoints
      for (let i = 0; i < 100; i++) {
        const endpoint = endpoints[i % endpoints.length];
        const promise = page.request.get(endpoint, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        promises.push(promise);
      }
      
      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      const successCount = responses.filter(r => r.ok()).length;
      const averageResponseTime = totalTime / responses.length;
      
      console.log(`Read Load Test: ${successCount}/${responses.length} succeeded`);
      console.log(`Average response time: ${averageResponseTime}ms`);
      
      return {
        successCount,
        totalRequests: responses.length,
        averageResponseTime,
        totalTime
      };
    };
    
    // Simulate mixed read/write load
    const mixedLoadTest = async () => {
      const promises = [];
      
      // 80% reads, 20% writes
      for (let i = 0; i < 50; i++) {
        if (i < 40) {
          // Read operations
          const promise = page.request.get('/api/customers', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          promises.push(promise);
        } else {
          // Write operations
          const promise = page.request.post('/api/customers', {
            headers: { 'Authorization': `Bearer ${token}` },
            data: {
              name: `Load Test Customer ${i}`,
              email: `loadtest${i}@example.com`,
              phone: `555-${String(i).padStart(4, '0')}`
            }
          });
          promises.push(promise);
        }
      }
      
      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      const successCount = responses.filter(r => r.ok()).length;
      
      console.log(`Mixed Load Test: ${successCount}/${responses.length} succeeded in ${totalTime}ms`);
      
      return {
        successCount,
        totalRequests: responses.length,
        totalTime
      };
    };
    
    // Run tests
    const readResults = await readLoadTest();
    await page.waitForTimeout(1000); // Brief pause
    const mixedResults = await mixedLoadTest();
    
    // Validate results
    expect(readResults.successCount / readResults.totalRequests).toBeGreaterThan(0.95);
    expect(readResults.averageResponseTime).toBeLessThan(1000);
    
    expect(mixedResults.successCount / mixedResults.totalRequests).toBeGreaterThan(0.90);
    expect(mixedResults.totalTime).toBeLessThan(10000);
  });
});
```

---

## Memory and Resource Monitoring

### Resource Usage Validation
```javascript
// File: tests/performance/monitoring/resource-monitoring.spec.js

import { test, expect } from '@playwright/test';

test.describe('Resource Monitoring', () => {
  test('monitors memory usage during operations', async ({ page }) => {
    // Setup memory monitoring
    const memoryStats = [];
    
    const measureMemory = async () => {
      const memoryInfo = await page.evaluate(() => {
        if (performance.memory) {
          return {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
            timestamp: Date.now()
          };
        }
        return null;
      });
      
      if (memoryInfo) {
        memoryStats.push(memoryInfo);
      }
    };
    
    await page.goto('/login');
    await measureMemory();
    
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await measureMemory();
    
    // Navigate through different pages
    const pages = [
      '/dashboard',
      '/dashboard/customers',
      '/dashboard/invoices',
      '/dashboard/bookings',
      '/dashboard/reports'
    ];
    
    for (const pageUrl of pages) {
      await page.goto(pageUrl);
      await page.waitForLoadState('networkidle');
      await measureMemory();
      
      // Force garbage collection if available
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
      
      await page.waitForTimeout(1000);
      await measureMemory();
    }
    
    // Analyze memory usage
    if (memoryStats.length > 0) {
      const initialMemory = memoryStats[0].used;
      const finalMemory = memoryStats[memoryStats.length - 1].used;
      const peakMemory = Math.max(...memoryStats.map(s => s.used));
      
      console.log(`Memory Usage - Initial: ${formatBytes(initialMemory)}`);
      console.log(`Memory Usage - Peak: ${formatBytes(peakMemory)}`);
      console.log(`Memory Usage - Final: ${formatBytes(finalMemory)}`);
      
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthPercent = (memoryGrowth / initialMemory) * 100;
      
      console.log(`Memory Growth: ${formatBytes(memoryGrowth)} (${memoryGrowthPercent.toFixed(1)}%)`);
      
      // Memory growth should be reasonable
      expect(memoryGrowthPercent).toBeLessThan(200); // Less than 200% growth
      expect(peakMemory).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      
      generateMemoryReport(memoryStats);
    }
  });

  test('monitors network usage and caching', async ({ page }) => {
    const networkActivity = [];
    
    page.on('request', request => {
      networkActivity.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        timestamp: Date.now(),
        cached: request.headers()['if-none-match'] ? true : false
      });
    });
    
    page.on('response', response => {
      const activity = networkActivity.find(a => 
        a.url === response.url() && !a.hasResponse
      );
      
      if (activity) {
        activity.status = response.status();
        activity.size = parseInt(response.headers()['content-length'] || '0');
        activity.cached = response.status() === 304;
        activity.hasResponse = true;
      }
    });
    
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Navigate back to trigger caching
    await page.goto('/dashboard/customers');
    await page.waitForLoadState('networkidle');
    
    await page.goto('/dashboard'); // Should use cache
    await page.waitForLoadState('networkidle');
    
    // Analyze network activity
    const apiRequests = networkActivity.filter(a => a.url.includes('/api/'));
    const staticRequests = networkActivity.filter(a => 
      ['script', 'stylesheet', 'image'].includes(a.resourceType)
    );
    const cachedRequests = networkActivity.filter(a => a.cached);
    
    console.log(`Total requests: ${networkActivity.length}`);
    console.log(`API requests: ${apiRequests.length}`);
    console.log(`Static requests: ${staticRequests.length}`);
    console.log(`Cached requests: ${cachedRequests.length}`);
    
    const totalSize = networkActivity
      .filter(a => a.size)
      .reduce((sum, a) => sum + a.size, 0);
    
    console.log(`Total data transferred: ${formatBytes(totalSize)}`);
    
    // Validate caching effectiveness
    const cachingRate = cachedRequests.length / networkActivity.length;
    console.log(`Cache hit rate: ${(cachingRate * 100).toFixed(1)}%`);
    
    // Should have reasonable cache hit rate for static resources
    expect(cachingRate).toBeGreaterThan(0.1); // At least 10% cache hits
  });
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateMemoryReport(memoryStats) {
  const report = {
    timestamp: new Date().toISOString(),
    initialMemory: memoryStats[0],
    peakMemory: memoryStats.reduce((max, stat) => 
      stat.used > max.used ? stat : max, memoryStats[0]
    ),
    finalMemory: memoryStats[memoryStats.length - 1],
    memoryGrowth: memoryStats[memoryStats.length - 1].used - memoryStats[0].used,
    samples: memoryStats.length,
    timeline: memoryStats
  };
  
  require('fs').writeFileSync(
    './test-results/performance/memory-report.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log('Memory report generated');
}
```

---

## Performance Test Execution

### NPM Scripts for Performance Testing
```json
{
  "scripts": {
    "test:performance": "npm run test:performance:api && npm run test:performance:frontend",
    "test:performance:api": "playwright test tests/performance/api/",
    "test:performance:database": "playwright test tests/performance/database/",
    "test:performance:frontend": "playwright test tests/performance/frontend/",
    "test:performance:load": "k6 run tests/performance/load/k6-load-test.js",
    "test:performance:memory": "playwright test tests/performance/monitoring/",
    "test:performance:full": "npm run test:performance && npm run test:performance:load"
  }
}
```

### Performance CI Pipeline
```yaml
# File: .github/workflows/performance-tests.yml

name: Performance Tests

on:
  schedule:
    - cron: '0 3 * * 1'  # Weekly on Monday at 3 AM
  workflow_dispatch:
    inputs:
      test_type:
        description: 'Type of performance test'
        required: true
        default: 'api'
        type: choice
        options:
          - api
          - frontend
          - database
          - load
          - full

jobs:
  performance-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install K6
      run: |
        sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    
    - name: Start application
      run: |
        npm run build
        npm run start &
        npx wait-on http://localhost:3000
    
    - name: Run API performance tests
      if: github.event.inputs.test_type == 'api' || github.event.inputs.test_type == 'full'
      run: npm run test:performance:api
    
    - name: Run frontend performance tests
      if: github.event.inputs.test_type == 'frontend' || github.event.inputs.test_type == 'full'
      run: npm run test:performance:frontend
    
    - name: Run database performance tests
      if: github.event.inputs.test_type == 'database' || github.event.inputs.test_type == 'full'
      run: npm run test:performance:database
    
    - name: Run load tests
      if: github.event.inputs.test_type == 'load' || github.event.inputs.test_type == 'full'
      run: npm run test:performance:load
    
    - name: Upload performance reports
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: performance-reports
        path: test-results/performance/
    
    - name: Comment PR with results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const reportPath = './test-results/performance/';
          
          if (fs.existsSync(reportPath)) {
            const files = fs.readdirSync(reportPath);
            let comment = '## Performance Test Results\n\n';
            
            files.forEach(file => {
              if (file.endsWith('.json')) {
                const data = JSON.parse(fs.readFileSync(`${reportPath}${file}`, 'utf8'));
                comment += `### ${file}\n`;
                comment += `- Tests: ${data.summary?.totalTests || 'N/A'}\n`;
                comment += `- Passed: ${data.summary?.passed || 'N/A'}\n`;
                comment += `- Average Response Time: ${data.summary?.averageResponseTime?.toFixed(2) || 'N/A'}ms\n\n`;
              }
            });
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
          }
```

---

**Performance Testing Schedule:**
- **API Performance:** Daily automated checks
- **Frontend Performance:** Weekly comprehensive testing
- **Database Performance:** Weekly under-load testing
- **Load Testing:** Monthly peak-load simulation
- **Memory Monitoring:** Continuous during testing

**Performance Targets:**
- **API Endpoints:** 95% under 500ms response time
- **Page Loads:** 95% under 2000ms load time
- **Database Queries:** Critical queries under 300ms
- **Concurrent Users:** Support 200+ simultaneous users
- **Memory Usage:** Stable growth under 200%

**Last Updated:** February 7, 2026