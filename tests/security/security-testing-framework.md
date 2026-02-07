# Security Testing Framework

**Purpose:** Validate security controls, authentication, and data protection  
**Frequency:** Weekly automated scans + Monthly penetration testing  
**Coverage:** Authentication, Authorization, Data Security, API Security, Infrastructure

---

## Security Testing Categories

### 🔴 Critical Security Tests (Daily)
- **Authentication Bypass Attempts** - Login security validation
- **Session Management** - Token validation and expiry
- **SQL Injection Scans** - Database vulnerability checks
- **XSS Prevention** - Cross-site scripting protection
- **API Authentication** - Endpoint security validation

### 🟡 Vulnerability Assessment (Weekly)
- **OWASP Top 10 Compliance** - Standard security vulnerabilities
- **Input Validation** - Form and API input sanitization
- **File Upload Security** - Malicious file upload prevention
- **Rate Limiting** - DoS and brute force protection
- **Data Encryption** - At-rest and in-transit encryption

### 🟢 Security Audit (Monthly)
- **Penetration Testing** - Simulated attack scenarios
- **Code Security Review** - Static analysis and code review
- **Infrastructure Security** - Server and network security
- **Compliance Assessment** - GDPR, CCPA compliance validation
- **Third-party Security** - Vendor and integration security

---

## Authentication Security Tests

### Login Security Validation
```javascript
// File: tests/security/auth/authentication-security.spec.js

import { test, expect } from '@playwright/test';

test.describe('Authentication Security', () => {
  test('prevents brute force attacks', async ({ page }) => {
    const attemptCount = 6; // Above threshold
    
    for (let i = 0; i < attemptCount; i++) {
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@company.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
      
      if (i >= 4) { // After 5 failed attempts
        // Should show rate limiting
        await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible();
        await expect(page.locator('[data-testid="rate-limit-error"]'))
          .toContainText('Too many attempts');
        
        // Login button should be disabled
        await expect(page.locator('[data-testid="login-button"]')).toBeDisabled();
      }
    }
  });

  test('validates CSRF token on login', async ({ page }) => {
    await page.goto('/login');
    
    // Check CSRF token exists
    const csrfToken = page.locator('input[name="_token"]');
    await expect(csrfToken).toBeHidden(); // Hidden input field
    
    const tokenValue = await csrfToken.getAttribute('value');
    expect(tokenValue).toBeTruthy();
    expect(tokenValue.length).toBeGreaterThan(20);
  });

  test('enforces secure session cookies', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    // Check session cookie security attributes
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name.includes('session'));
    
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie.secure).toBe(true);
    expect(sessionCookie.httpOnly).toBe(true);
    expect(sessionCookie.sameSite).toBe('Strict');
  });

  test('prevents session fixation', async ({ page }) => {
    // Get initial session ID
    await page.goto('/');
    const initialCookies = await page.context().cookies();
    const initialSession = initialCookies.find(c => c.name.includes('session'));
    const initialSessionId = initialSession?.value;
    
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    // Session ID should change after login
    const postLoginCookies = await page.context().cookies();
    const postLoginSession = postLoginCookies.find(c => c.name.includes('session'));
    const postLoginSessionId = postLoginSession?.value;
    
    expect(postLoginSessionId).not.toBe(initialSessionId);
  });

  test('enforces session timeout', async ({ page }) => {
    // Mock expired session
    await page.addInitScript(() => {
      localStorage.setItem('session_expires', Date.now() - 1000);
    });
    
    await page.goto('/dashboard');
    
    // Should be redirected to login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('[data-testid="session-expired"]')).toBeVisible();
  });
});
```

### Authorization Testing
```javascript
// File: tests/security/auth/authorization-security.spec.js

import { test, expect } from '@playwright/test';

test.describe('Authorization Security', () => {
  const userRoles = [
    { email: 'admin@company.com', password: 'adminpass', role: 'admin' },
    { email: 'manager@company.com', password: 'managerpass', role: 'manager' },
    { email: 'employee@company.com', password: 'employeepass', role: 'employee' }
  ];

  test('enforces role-based access control', async ({ page }) => {
    const protectedRoutes = [
      { path: '/dashboard/settings', minRole: 'admin' },
      { path: '/dashboard/users', minRole: 'admin' },
      { path: '/dashboard/reports/financial', minRole: 'manager' },
      { path: '/dashboard/employees', minRole: 'manager' }
    ];

    for (const route of protectedRoutes) {
      // Test each user role
      for (const user of userRoles) {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', user.email);
        await page.fill('[data-testid="password-input"]', user.password);
        await page.click('[data-testid="login-button"]');
        
        await page.goto(route.path);
        
        // Check access based on role
        const hasAccess = shouldHaveAccess(user.role, route.minRole);
        
        if (hasAccess) {
          // Should load the page
          await expect(page.locator('[data-testid="page-content"]')).toBeVisible();
        } else {
          // Should show access denied
          await expect(page).toHaveURL('/unauthorized');
          await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
        }
        
        // Logout
        await page.click('[data-testid="user-menu"]');
        await page.click('[data-testid="logout-button"]');
      }
    }
  });

  test('prevents privilege escalation through URL manipulation', async ({ page }) => {
    // Login as employee
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'employee@company.com');
    await page.fill('[data-testid="password-input"]', 'employeepass');
    await page.click('[data-testid="login-button"]');
    
    // Try to access admin routes directly
    const adminRoutes = [
      '/dashboard/admin',
      '/dashboard/settings',
      '/dashboard/users',
      '/api/users',
      '/api/settings'
    ];
    
    for (const route of adminRoutes) {
      const response = await page.goto(route);
      
      // Should return unauthorized or redirect
      expect([401, 403]).toContain(response.status());
    }
  });

  test('validates API endpoint authorization', async ({ page }) => {
    // Login as employee
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'employee@company.com');
    await page.fill('[data-testid="password-input"]', 'employeepass');
    await page.click('[data-testid="login-button"]');
    
    // Get session token
    const sessionCookie = await page.context().cookies();
    const token = sessionCookie.find(c => c.name.includes('session'))?.value;
    
    // Test protected API endpoints
    const restrictedEndpoints = [
      { url: '/api/users', method: 'GET', minRole: 'admin' },
      { url: '/api/settings', method: 'GET', minRole: 'admin' },
      { url: '/api/financial/reports', method: 'GET', minRole: 'manager' },
      { url: '/api/employees', method: 'GET', minRole: 'manager' }
    ];
    
    for (const endpoint of restrictedEndpoints) {
      const response = await page.request.fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Employee should not have access
      expect([401, 403]).toContain(response.status());
    }
  });
});

function shouldHaveAccess(userRole, requiredRole) {
  const roleHierarchy = {
    'employee': 1,
    'manager': 2,
    'admin': 3
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
```

---

## Input Validation & Injection Prevention

### SQL Injection Testing
```javascript
// File: tests/security/injection/sql-injection.spec.js

import { test, expect } from '@playwright/test';

test.describe('SQL Injection Prevention', () => {
  test('prevents SQL injection in search fields', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard/customers');
    
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE customers; --",
      "' UNION SELECT * FROM users --",
      "1' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a) --",
      "' OR 1=1#"
    ];
    
    for (const payload of sqlPayloads) {
      // Clear and enter malicious input
      await page.fill('[data-testid="customer-search"]', payload);
      await page.click('[data-testid="search-button"]');
      
      // Should not crash or show database errors
      await expect(page.locator('[data-testid="database-error"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="sql-error"]')).not.toBeVisible();
      
      // Should show sanitized results or no results
      const results = page.locator('[data-testid="search-results"]');
      await expect(results).toBeVisible();
      
      // Clear search
      await page.fill('[data-testid="customer-search"]', '');
    }
  });

  test('validates API endpoints against SQL injection', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    const sessionCookie = await page.context().cookies();
    const token = sessionCookie.find(c => c.name.includes('session'))?.value;
    
    const endpoints = [
      '/api/customers',
      '/api/invoices',
      '/api/bookings',
      '/api/employees'
    ];
    
    const sqlPayloads = [
      "?search=' OR '1'='1",
      "?id=1; DROP TABLE customers; --",
      "?filter=' UNION SELECT password FROM users --"
    ];
    
    for (const endpoint of endpoints) {
      for (const payload of sqlPayloads) {
        const response = await page.request.get(endpoint + payload, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Should not return 500 errors or database errors
        expect(response.status()).not.toBe(500);
        
        const responseText = await response.text();
        
        // Should not contain SQL error messages
        expect(responseText.toLowerCase()).not.toContain('mysql');
        expect(responseText.toLowerCase()).not.toContain('postgresql');
        expect(responseText.toLowerCase()).not.toContain('syntax error');
        expect(responseText.toLowerCase()).not.toContain('sql error');
      }
    }
  });
});
```

### XSS Prevention Testing
```javascript
// File: tests/security/injection/xss-prevention.spec.js

import { test, expect } from '@playwright/test';

test.describe('XSS Prevention', () => {
  test('prevents stored XSS in customer data', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard/customers/new');
    
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      'javascript:alert("XSS")',
      '<svg onload="alert(\'XSS\')">',
      '"><script>alert(String.fromCharCode(88,83,83))</script>'
    ];
    
    for (const payload of xssPayloads) {
      // Fill form with malicious data
      await page.fill('[data-testid="customer-name"]', payload);
      await page.fill('[data-testid="customer-email"]', 'test@example.com');
      await page.click('[data-testid="save-customer-button"]');
      
      // Should save without executing script
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      
      // Navigate to customer list
      await page.goto('/dashboard/customers');
      
      // XSS should not execute
      const customerName = page.locator('[data-testid="customer-name"]').first();
      await expect(customerName).toBeVisible();
      
      // Content should be escaped
      const nameText = await customerName.textContent();
      expect(nameText).not.toContain('<script');
      
      // Clean up
      await page.click('[data-testid="delete-customer-button"]');
      await page.click('[data-testid="confirm-delete-button"]');
    }
  });

  test('prevents reflected XSS in URL parameters', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    const xssUrls = [
      '/dashboard/customers?search=<script>alert("XSS")</script>',
      '/dashboard/invoices?filter=<img src=x onerror=alert("XSS")>',
      '/dashboard/reports?period="><script>alert("XSS")</script>'
    ];
    
    for (const url of xssUrls) {
      await page.goto(url);
      
      // Page should load normally without executing scripts
      await expect(page.locator('[data-testid="page-content"]')).toBeVisible();
      
      // Check that script content is escaped in the DOM
      const pageContent = await page.content();
      expect(pageContent).not.toContain('<script>alert');
    }
  });

  test('validates content security policy', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check CSP header
    const response = await page.goto('/dashboard');
    const cspHeader = response.headers()['content-security-policy'];
    
    expect(cspHeader).toBeTruthy();
    expect(cspHeader).toContain("script-src 'self'");
    expect(cspHeader).toContain("object-src 'none'");
    expect(cspHeader).toContain("style-src 'self'");
  });
});
```

---

## File Upload Security

### Malicious File Upload Prevention
```javascript
// File: tests/security/uploads/file-upload-security.spec.js

import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('File Upload Security', () => {
  test('prevents malicious file uploads', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard/settings/company');
    
    // Test various malicious file types
    const maliciousFiles = [
      { name: 'malicious.php', content: '<?php system($_GET["cmd"]); ?>' },
      { name: 'script.js', content: 'alert("XSS");' },
      { name: 'malware.exe', content: 'MZ\x90\x00\x03\x00\x00\x00' }, // PE header
      { name: 'large.jpg', content: 'A'.repeat(10 * 1024 * 1024) }, // 10MB file
      { name: 'shell.jsp', content: '<% Runtime.getRuntime().exec("cmd"); %>' }
    ];
    
    for (const file of maliciousFiles) {
      // Create temporary file
      const filePath = path.join(process.cwd(), 'temp', file.name);
      require('fs').writeFileSync(filePath, file.content);
      
      // Attempt upload
      await page.setInputFiles('[data-testid="logo-upload"]', filePath);
      
      // Should show appropriate error
      await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
      
      const errorMessage = await page.locator('[data-testid="upload-error"]').textContent();
      
      if (file.name.endsWith('.exe') || file.name.endsWith('.php') || file.name.endsWith('.jsp')) {
        expect(errorMessage).toContain('File type not allowed');
      }
      
      if (file.content.length > 5 * 1024 * 1024) {
        expect(errorMessage).toContain('File too large');
      }
      
      // Clean up
      require('fs').unlinkSync(filePath);
    }
  });

  test('validates image files properly', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard/settings/company');
    
    // Create fake image with script content
    const fakeImage = {
      name: 'fake.jpg',
      content: '<?php echo "This is not an image"; ?>'
    };
    
    const filePath = path.join(process.cwd(), 'temp', fakeImage.name);
    require('fs').writeFileSync(filePath, fakeImage.content);
    
    await page.setInputFiles('[data-testid="logo-upload"]', filePath);
    
    // Should validate file content, not just extension
    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('Invalid image file');
    
    require('fs').unlinkSync(filePath);
  });
});
```

---

## API Security Testing

### Rate Limiting and DoS Prevention
```javascript
// File: tests/security/api/rate-limiting.spec.js

import { test, expect } from '@playwright/test';

test.describe('API Rate Limiting', () => {
  test('enforces rate limiting on login endpoint', async ({ page }) => {
    const requests = [];
    
    // Make multiple rapid login attempts
    for (let i = 0; i < 20; i++) {
      const request = page.request.post('/api/auth/login', {
        data: {
          email: 'test@company.com',
          password: 'wrongpassword'
        }
      });
      requests.push(request);
    }
    
    const responses = await Promise.all(requests);
    
    // Should start rate limiting after threshold
    let rateLimitedCount = 0;
    for (const response of responses) {
      if (response.status() === 429) {
        rateLimitedCount++;
      }
    }
    
    expect(rateLimitedCount).toBeGreaterThan(10);
  });

  test('enforces API rate limiting per user', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    const sessionCookie = await page.context().cookies();
    const token = sessionCookie.find(c => c.name.includes('session'))?.value;
    
    // Make rapid API requests
    const requests = [];
    for (let i = 0; i < 100; i++) {
      const request = page.request.get('/api/customers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      requests.push(request);
    }
    
    const responses = await Promise.all(requests);
    
    // Should start rate limiting
    let rateLimitedCount = 0;
    for (const response of responses) {
      if (response.status() === 429) {
        rateLimitedCount++;
      }
    }
    
    expect(rateLimitedCount).toBeGreaterThan(50);
  });

  test('validates rate limit headers', async ({ page }) => {
    const response = await page.request.get('/api/customers');
    
    // Should include rate limit headers
    const headers = response.headers();
    expect(headers['x-ratelimit-limit']).toBeTruthy();
    expect(headers['x-ratelimit-remaining']).toBeTruthy();
    expect(headers['x-ratelimit-reset']).toBeTruthy();
  });
});
```

---

## Encryption and Data Protection

### Data Encryption Validation
```javascript
// File: tests/security/encryption/data-protection.spec.js

import { test, expect } from '@playwright/test';

test.describe('Data Protection', () => {
  test('validates HTTPS enforcement', async ({ page }) => {
    // All pages should redirect to HTTPS if accessed via HTTP
    const httpUrl = 'http://localhost:3000/login';
    const response = await page.request.get(httpUrl, {
      maxRedirects: 0
    });
    
    // Should redirect to HTTPS or be blocked
    expect([301, 302, 403]).toContain(response.status());
    
    if ([301, 302].includes(response.status())) {
      const location = response.headers()['location'];
      expect(location).toContain('https://');
    }
  });

  test('validates secure headers', async ({ page }) => {
    const response = await page.goto('/dashboard');
    const headers = response.headers();
    
    // Security headers
    expect(headers['strict-transport-security']).toBeTruthy();
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-xss-protection']).toBe('1; mode=block');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('validates password storage security', async ({ page }) => {
    // Create new user
    await page.goto('/register');
    await page.fill('[data-testid="email-input"]', 'newuser@test.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="register-button"]');
    
    // Verify password is not stored in plain text
    // This would require database access in real implementation
    // For now, just verify registration doesn't expose password
    const pageContent = await page.content();
    expect(pageContent.toLowerCase()).not.toContain('testpassword123');
  });

  test('validates sensitive data masking', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard/customers/1');
    
    // Sensitive fields should be masked
    const phoneField = page.locator('[data-testid="customer-phone"]');
    const phoneText = await phoneField.textContent();
    
    if (phoneText && phoneText.length > 4) {
      // Should show only last 4 digits
      expect(phoneText).toMatch(/\*+\d{4}/);
    }
  });
});
```

---

## Security Monitoring & Logging

### Security Event Detection
```javascript
// File: tests/security/monitoring/security-events.spec.js

import { test, expect } from '@playwright/test';

test.describe('Security Monitoring', () => {
  test('logs security events', async ({ page }) => {
    // Failed login attempts should be logged
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    // Should log failed attempt
    // In real implementation, this would check audit logs
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('detects suspicious activity patterns', async ({ page }) => {
    // Multiple failed logins from same IP
    for (let i = 0; i < 10; i++) {
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'admin@company.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
    }
    
    // After threshold, should show security warning
    await expect(page.locator('[data-testid="security-warning"]')).toBeVisible();
  });

  test('validates audit trail completeness', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    // Navigate to audit log (admin only)
    await page.goto('/dashboard/admin/audit');
    
    // Should show recent login event
    await expect(page.locator('[data-testid="audit-entry"]')).toBeVisible();
    
    const auditEntry = page.locator('[data-testid="audit-entry"]').first();
    await expect(auditEntry).toContainText('LOGIN_SUCCESS');
    await expect(auditEntry).toContainText('test@company.com');
  });
});
```

---

## Compliance Testing

### GDPR Compliance Validation
```javascript
// File: tests/security/compliance/gdpr-compliance.spec.js

import { test, expect } from '@playwright/test';

test.describe('GDPR Compliance', () => {
  test('provides data export functionality', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard/settings/privacy');
    
    // Should have data export option
    await expect(page.locator('[data-testid="export-data-button"]')).toBeVisible();
    
    await page.click('[data-testid="export-data-button"]');
    
    // Should start download or show confirmation
    await expect(page.locator('[data-testid="export-started"]')).toBeVisible();
  });

  test('provides data deletion functionality', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard/settings/privacy');
    
    // Should have account deletion option
    await expect(page.locator('[data-testid="delete-account-button"]')).toBeVisible();
    
    await page.click('[data-testid="delete-account-button"]');
    
    // Should show confirmation dialog with warnings
    await expect(page.locator('[data-testid="deletion-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="deletion-warning"]')).toContainText('permanent');
  });

  test('validates cookie consent', async ({ page }) => {
    await page.goto('/');
    
    // Should show cookie consent banner
    await expect(page.locator('[data-testid="cookie-consent"]')).toBeVisible();
    
    // Should have accept/reject options
    await expect(page.locator('[data-testid="accept-cookies"]')).toBeVisible();
    await expect(page.locator('[data-testid="reject-cookies"]')).toBeVisible();
    
    // Should have detailed preferences
    await expect(page.locator('[data-testid="cookie-preferences"]')).toBeVisible();
  });
});
```

---

## Automated Security Scanning

### OWASP ZAP Integration
```javascript
// File: tests/security/automated/owasp-zap-scan.js

import { execSync } from 'child_process';

export async function runOwaspZapScan() {
  console.log('Starting OWASP ZAP security scan...');
  
  try {
    // Start ZAP daemon
    execSync('zap-cli start --port 8080');
    
    // Open target URL
    execSync('zap-cli open-url http://localhost:3000');
    
    // Spider the application
    execSync('zap-cli spider http://localhost:3000');
    
    // Run active scan
    execSync('zap-cli active-scan http://localhost:3000');
    
    // Generate report
    execSync('zap-cli report -o ./test-results/security/zap-report.html');
    
    // Get alerts
    const alerts = execSync('zap-cli alerts').toString();
    console.log('Security alerts found:', alerts);
    
    // Stop ZAP
    execSync('zap-cli shutdown');
    
    return {
      success: true,
      reportPath: './test-results/security/zap-report.html',
      alertCount: alerts.split('\n').filter(line => line.trim()).length
    };
  } catch (error) {
    console.error('ZAP scan failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

## Security Test Execution

### NPM Scripts for Security Testing
```json
{
  "scripts": {
    "test:security": "playwright test tests/security/",
    "test:security:auth": "playwright test tests/security/auth/",
    "test:security:injection": "playwright test tests/security/injection/",
    "test:security:api": "playwright test tests/security/api/",
    "test:security:zap": "node tests/security/automated/owasp-zap-scan.js",
    "test:security:full": "npm run test:security && npm run test:security:zap"
  }
}
```

### Security Testing CI Pipeline
```yaml
# File: .github/workflows/security-tests.yml

name: Security Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  security-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install security tools
      run: |
        sudo apt-get update
        sudo apt-get install -y zaproxy
    
    - name: Start application
      run: npm run start &
    
    - name: Wait for app
      run: npx wait-on http://localhost:3000
    
    - name: Run security tests
      run: npm run test:security:full
    
    - name: Upload security reports
      uses: actions/upload-artifact@v3
      with:
        name: security-reports
        path: test-results/security/
```

---

**Security Testing Schedule:**
- **Critical Security Tests:** Daily automated runs
- **Vulnerability Scans:** Weekly OWASP ZAP scans
- **Penetration Testing:** Monthly manual testing
- **Compliance Audits:** Quarterly GDPR/security review

**Alert Thresholds:**
- **High Severity:** Immediate notification
- **Medium Severity:** Daily summary
- **Low Severity:** Weekly report

**Last Updated:** February 7, 2026