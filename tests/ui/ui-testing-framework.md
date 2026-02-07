# User Interface Testing Framework

**Purpose:** Validate all user-facing functionality across desktop, tablet, and mobile  
**Frequency:** Weekly automated tests + On-demand for releases  
**Coverage:** Dashboard, Forms, Reports, Navigation, Responsive Design

---

## Test Categories

### 🔴 Critical User Flows (Daily)
- **Authentication Flow** - Login, logout, session management
- **Dashboard Loading** - Main dashboard and key metrics display
- **Invoice Creation** - Complete invoice workflow
- **Booking Management** - Tour booking process
- **Payment Processing** - Payment form and Stripe integration

### 🟡 Feature Testing (Weekly)
- **All Form Validations** - Input validation and error handling
- **Report Generation** - PDF generation and viewing
- **Data Grid Operations** - Sorting, filtering, pagination
- **Navigation** - Menu structure and routing
- **Responsive Design** - Mobile and tablet layouts

### 🟢 User Experience (Monthly)
- **Performance Testing** - Page load times and responsiveness
- **Accessibility** - WCAG compliance and screen reader support
- **Cross-browser Testing** - Chrome, Firefox, Safari, Edge
- **Device Testing** - Various screen sizes and orientations

---

## Automated UI Testing Stack

### Playwright Test Framework
```javascript
// File: tests/ui/playwright.config.js

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: './test-results/html-report' }],
    ['json', { outputFile: './test-results/test-results.json' }],
    ['junit', { outputFile: './test-results/junit.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## Critical User Flow Tests

### 1. Authentication & Session Management
```javascript
// File: tests/ui/auth/authentication.spec.js

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    
    // Check login form is visible
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    // Fill login credentials
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    
    // Submit form
    await page.click('[data-testid="login-button"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Should show user menu
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Should display company name
    await expect(page.locator('[data-testid="company-name"]')).toBeVisible();
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="email-input"]', 'invalid@email.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
    
    // Should stay on login page
    await expect(page).toHaveURL('/login');
  });

  test('logout clears session and redirects', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Click logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    
    // Attempting to access protected page should redirect to login
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('session expires after timeout', async ({ page }) => {
    // Mock expired session
    await page.addInitScript(() => {
      localStorage.setItem('session_expires', Date.now() - 1000); // Expired
    });
    
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    
    // Should show session expired message
    await expect(page.locator('[data-testid="session-expired"]')).toBeVisible();
  });
});
```

### 2. Dashboard Functionality
```javascript
// File: tests/ui/dashboard/dashboard.spec.js

import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('dashboard loads with all key metrics', async ({ page }) => {
    // Check main dashboard elements
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
    
    // Revenue metrics
    await expect(page.locator('[data-testid="revenue-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="revenue-amount"]')).toBeVisible();
    
    // Booking metrics  
    await expect(page.locator('[data-testid="bookings-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="bookings-count"]')).toBeVisible();
    
    // Outstanding invoices
    await expect(page.locator('[data-testid="outstanding-invoices"]')).toBeVisible();
    
    // Recent activity
    await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();
  });

  test('navigation menu works correctly', async ({ page }) => {
    // Test main navigation items
    const navItems = [
      { selector: '[data-testid="nav-dashboard"]', url: '/dashboard' },
      { selector: '[data-testid="nav-invoices"]', url: '/dashboard/invoices' },
      { selector: '[data-testid="nav-bookings"]', url: '/dashboard/bookings' },
      { selector: '[data-testid="nav-customers"]', url: '/dashboard/customers' },
      { selector: '[data-testid="nav-reports"]', url: '/dashboard/reports' }
    ];
    
    for (const item of navItems) {
      await page.click(item.selector);
      await expect(page).toHaveURL(item.url);
      
      // Verify page loads correctly
      await expect(page.locator('[data-testid="page-loading"]')).not.toBeVisible();
    }
  });

  test('quick actions work', async ({ page }) => {
    // Create new invoice
    await page.click('[data-testid="quick-create-invoice"]');
    await expect(page).toHaveURL('/dashboard/invoices/new');
    
    await page.goBack();
    
    // Create new booking
    await page.click('[data-testid="quick-create-booking"]');
    await expect(page).toHaveURL('/dashboard/bookings/new');
    
    await page.goBack();
    
    // Add new customer
    await page.click('[data-testid="quick-create-customer"]');
    await expect(page).toHaveURL('/dashboard/customers/new');
  });
});
```

### 3. Invoice Management Flow
```javascript
// File: tests/ui/financial/invoice-management.spec.js

import { test, expect } from '@playwright/test';

test.describe('Invoice Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
  });

  test('create new invoice end-to-end', async ({ page }) => {
    await page.goto('/dashboard/invoices');
    
    // Click create new invoice
    await page.click('[data-testid="create-invoice-button"]');
    await expect(page).toHaveURL('/dashboard/invoices/new');
    
    // Fill customer information
    await page.click('[data-testid="customer-select"]');
    await page.click('[data-testid="customer-option-1"]');
    
    // Set invoice details
    await page.fill('[data-testid="invoice-date"]', '2026-02-07');
    await page.fill('[data-testid="due-date"]', '2026-03-07');
    
    // Add invoice items
    await page.click('[data-testid="add-item-button"]');
    await page.fill('[data-testid="item-description-0"]', 'Test Service');
    await page.fill('[data-testid="item-quantity-0"]', '1');
    await page.fill('[data-testid="item-price-0"]', '100.00');
    
    // Verify total calculation
    await expect(page.locator('[data-testid="invoice-total"]')).toHaveText('$100.00');
    
    // Save as draft
    await page.click('[data-testid="save-draft-button"]');
    
    // Should redirect to invoice detail
    await expect(page.url()).toMatch(/\\/dashboard\\/invoices\\/[0-9]+/);
    
    // Verify invoice was created
    await expect(page.locator('[data-testid="invoice-status"]')).toHaveText('Draft');
  });

  test('send invoice to customer', async ({ page }) => {
    // Navigate to an existing draft invoice
    await page.goto('/dashboard/invoices/1');
    
    // Click send invoice
    await page.click('[data-testid="send-invoice-button"]');
    
    // Confirm in modal
    await expect(page.locator('[data-testid="send-confirmation-modal"]')).toBeVisible();
    await page.click('[data-testid="confirm-send-button"]');
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Invoice sent');
    
    // Status should update
    await expect(page.locator('[data-testid="invoice-status"]')).toHaveText('Sent');
  });

  test('record payment against invoice', async ({ page }) => {
    await page.goto('/dashboard/invoices/1');
    
    // Click record payment
    await page.click('[data-testid="record-payment-button"]');
    
    // Fill payment details
    await expect(page.locator('[data-testid="payment-modal"]')).toBeVisible();
    await page.fill('[data-testid="payment-amount"]', '100.00');
    await page.selectOption('[data-testid="payment-method"]', 'bank_transfer');
    await page.fill('[data-testid="payment-reference"]', 'TXN-12345');
    
    // Submit payment
    await page.click('[data-testid="submit-payment-button"]');
    
    // Should show success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    
    // Invoice status should update
    await expect(page.locator('[data-testid="invoice-status"]')).toHaveText('Paid');
  });
});
```

### 4. Booking Management Flow
```javascript
// File: tests/ui/operations/booking-management.spec.js

import { test, expect } from '@playwright/test';

test.describe('Booking Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');  
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
  });

  test('create tour booking', async ({ page }) => {
    await page.goto('/dashboard/bookings');
    
    await page.click('[data-testid="create-booking-button"]');
    
    // Select customer
    await page.click('[data-testid="customer-select"]');
    await page.click('[data-testid="customer-option-1"]');
    
    // Select tour package
    await page.click('[data-testid="tour-select"]');
    await page.click('[data-testid="tour-safari-package"]');
    
    // Set dates
    await page.fill('[data-testid="check-in-date"]', '2026-03-01');
    await page.fill('[data-testid="check-out-date"]', '2026-03-05');
    
    // Number of guests
    await page.fill('[data-testid="guest-count"]', '2');
    
    // Add special requests
    await page.fill('[data-testid="special-requests"]', 'Vegetarian meals required');
    
    // Save booking
    await page.click('[data-testid="save-booking-button"]');
    
    // Should redirect to booking detail
    await expect(page.url()).toMatch(/\\/dashboard\\/bookings\\/[0-9]+/);
    
    // Verify booking details
    await expect(page.locator('[data-testid="booking-status"]')).toHaveText('Confirmed');
    await expect(page.locator('[data-testid="guest-count-display"]')).toHaveText('2');
  });

  test('generate invoice from booking', async ({ page }) => {
    await page.goto('/dashboard/bookings/1');
    
    // Click generate invoice
    await page.click('[data-testid="generate-invoice-button"]');
    
    // Choose invoice type
    await expect(page.locator('[data-testid="invoice-type-modal"]')).toBeVisible();
    await page.click('[data-testid="full-invoice-option"]');
    
    // Should redirect to new invoice
    await expect(page.url()).toMatch(/\\/dashboard\\/invoices\\/[0-9]+/);
    
    // Verify invoice has booking items
    await expect(page.locator('[data-testid="invoice-items"]')).toContainText('Safari Package');
    
    // Verify linked booking reference
    await expect(page.locator('[data-testid="booking-reference"]')).toBeVisible();
  });
});
```

---

## Form Validation Testing

### Generic Form Validation Tests
```javascript
// File: tests/ui/forms/form-validation.spec.js

import { test, expect } from '@playwright/test';

test.describe('Form Validation', () => {
  const forms = [
    {
      name: 'Invoice Form',
      url: '/dashboard/invoices/new',
      fields: [
        { selector: '[data-testid="customer-select"]', required: true },
        { selector: '[data-testid="invoice-date"]', required: true, type: 'date' },
        { selector: '[data-testid="due-date"]', required: true, type: 'date' },
        { selector: '[data-testid="item-description-0"]', required: true, type: 'text' }
      ]
    },
    {
      name: 'Customer Form',
      url: '/dashboard/customers/new',
      fields: [
        { selector: '[data-testid="customer-name"]', required: true, type: 'text' },
        { selector: '[data-testid="customer-email"]', required: true, type: 'email' },
        { selector: '[data-testid="customer-phone"]', required: false, type: 'tel' }
      ]
    },
    {
      name: 'Booking Form',
      url: '/dashboard/bookings/new',
      fields: [
        { selector: '[data-testid="customer-select"]', required: true },
        { selector: '[data-testid="tour-select"]', required: true },
        { selector: '[data-testid="check-in-date"]', required: true, type: 'date' },
        { selector: '[data-testid="guest-count"]', required: true, type: 'number' }
      ]
    }
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
  });

  for (const form of forms) {
    test(`${form.name} - required field validation`, async ({ page }) => {
      await page.goto(form.url);
      
      // Try to submit empty form
      await page.click('[data-testid="submit-button"]');
      
      // Check required field errors
      for (const field of form.fields.filter(f => f.required)) {
        await expect(page.locator(`${field.selector}-error`)).toBeVisible();
      }
    });

    test(`${form.name} - email validation`, async ({ page }) => {
      const emailFields = form.fields.filter(f => f.type === 'email');
      
      if (emailFields.length === 0) return;
      
      await page.goto(form.url);
      
      for (const field of emailFields) {
        // Test invalid email
        await page.fill(field.selector, 'invalid-email');
        await page.click('[data-testid="submit-button"]');
        
        await expect(page.locator(`${field.selector}-error`)).toContainText('valid email');
        
        // Test valid email
        await page.fill(field.selector, 'test@example.com');
        await expect(page.locator(`${field.selector}-error`)).not.toBeVisible();
      }
    });

    test(`${form.name} - number validation`, async ({ page }) => {
      const numberFields = form.fields.filter(f => f.type === 'number');
      
      if (numberFields.length === 0) return;
      
      await page.goto(form.url);
      
      for (const field of numberFields) {
        // Test invalid number
        await page.fill(field.selector, 'not-a-number');
        await expect(page.locator(field.selector)).toHaveValue('');
        
        // Test negative number where not allowed
        await page.fill(field.selector, '-5');
        await page.click('[data-testid="submit-button"]');
        
        // Test valid number
        await page.fill(field.selector, '10');
        await expect(page.locator(`${field.selector}-error`)).not.toBeVisible();
      }
    });
  }
});
```

---

## Responsive Design Testing

### Mobile and Tablet Compatibility
```javascript
// File: tests/ui/responsive/responsive-design.spec.js

import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1920, height: 1080 }
  ];

  for (const viewport of viewports) {
    test.describe(`${viewport.name} viewport`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('dashboard is responsive', async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'test@company.com');
        await page.fill('[data-testid="password-input"]', 'testpassword');
        await page.click('[data-testid="login-button"]');
        
        await page.goto('/dashboard');
        
        // Check mobile navigation
        if (viewport.width < 768) {
          await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
          await expect(page.locator('[data-testid="desktop-navigation"]')).not.toBeVisible();
          
          // Test mobile menu
          await page.click('[data-testid="mobile-menu-button"]');
          await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
        } else {
          await expect(page.locator('[data-testid="desktop-navigation"]')).toBeVisible();
          await expect(page.locator('[data-testid="mobile-menu-button"]')).not.toBeVisible();
        }
        
        // Check metric cards layout
        const metricCards = page.locator('[data-testid="metric-card"]');
        await expect(metricCards.first()).toBeVisible();
        
        // Check charts responsiveness
        await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
      });

      test('forms are usable on different screen sizes', async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'test@company.com');
        await page.fill('[data-testid="password-input"]', 'testpassword');
        await page.click('[data-testid="login-button"]');
        
        await page.goto('/dashboard/invoices/new');
        
        // Form should be scrollable and usable
        await expect(page.locator('[data-testid="invoice-form"]')).toBeVisible();
        
        // Inputs should be appropriately sized
        const inputs = page.locator('input[type="text"], select, textarea');
        const inputCount = await inputs.count();
        
        for (let i = 0; i < inputCount; i++) {
          const input = inputs.nth(i);
          const boundingBox = await input.boundingBox();
          
          if (boundingBox) {
            // Inputs should have reasonable touch targets on mobile
            if (viewport.width < 768) {
              expect(boundingBox.height).toBeGreaterThanOrEqual(44); // iOS recommendation
            }
          }
        }
      });

      test('tables are responsive', async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'test@company.com');
        await page.fill('[data-testid="password-input"]', 'testpassword');
        await page.click('[data-testid="login-button"]');
        
        await page.goto('/dashboard/invoices');
        
        await expect(page.locator('[data-testid="invoices-table"]')).toBeVisible();
        
        // On mobile, table should be horizontally scrollable or use cards
        if (viewport.width < 768) {
          const table = page.locator('[data-testid="invoices-table"]');
          const isScrollable = await table.evaluate(el => 
            el.scrollWidth > el.clientWidth
          );
          
          // Either scrollable or using card layout
          const hasCards = await page.locator('[data-testid="invoice-card"]').count() > 0;
          
          expect(isScrollable || hasCards).toBeTruthy();
        }
      });
    });
  }
});
```

---

## Performance Testing

### Page Load Performance
```javascript
// File: tests/ui/performance/page-performance.spec.js

import { test, expect } from '@playwright/test';

test.describe('Page Performance', () => {
  test('dashboard loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    // Wait for dashboard to be fully loaded
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    console.log(`Dashboard load time: ${loadTime}ms`);
  });

  test('report generation performance', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard/reports');
    
    const startTime = Date.now();
    
    // Generate profit & loss report
    await page.click('[data-testid="profit-loss-report"]');
    await page.selectOption('[data-testid="report-period"]', 'last-month');
    await page.click('[data-testid="generate-report-button"]');
    
    // Wait for report to load
    await expect(page.locator('[data-testid="report-content"]')).toBeVisible();
    
    const reportTime = Date.now() - startTime;
    
    // Report should generate within 5 seconds
    expect(reportTime).toBeLessThan(5000);
    
    console.log(`Report generation time: ${reportTime}ms`);
  });
});
```

---

## Accessibility Testing

### WCAG Compliance Check
```javascript
// File: tests/ui/accessibility/accessibility.spec.js

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('dashboard meets WCAG standards', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('forms are keyboard navigable', async ({ page }) => {
    await page.goto('/dashboard/invoices/new');
    
    // Tab through form elements
    await page.keyboard.press('Tab'); // Customer select
    await page.keyboard.press('Tab'); // Invoice date
    await page.keyboard.press('Tab'); // Due date
    await page.keyboard.press('Tab'); // Item description
    
    // Should be able to interact with focused elements
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('has proper ARIA labels and roles', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check main navigation has proper ARIA
    await expect(page.locator('[data-testid="main-navigation"]')).toHaveAttribute('role', 'navigation');
    
    // Check buttons have accessible names
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const hasAriaLabel = await button.getAttribute('aria-label');
      const hasText = await button.textContent();
      
      expect(hasAriaLabel || hasText).toBeTruthy();
    }
  });
});
```

---

## Visual Regression Testing

### Screenshot Comparison
```javascript
// File: tests/ui/visual/visual-regression.spec.js

import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('dashboard visual consistency', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@company.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/dashboard');
    
    // Wait for all content to load
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
    
    // Take screenshot and compare
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      threshold: 0.2, // Allow for minor differences
    });
  });

  test('invoice form visual consistency', async ({ page }) => {
    await page.goto('/dashboard/invoices/new');
    
    await expect(page.locator('[data-testid="invoice-form"]')).toBeVisible();
    
    await expect(page.locator('[data-testid="invoice-form"]')).toHaveScreenshot('invoice-form.png');
  });
});
```

---

## Test Execution Scripts

### NPM Scripts for UI Testing
```json
{
  "scripts": {
    "test:ui": "playwright test",
    "test:ui:headed": "playwright test --headed",
    "test:ui:debug": "playwright test --debug",
    "test:ui:report": "playwright show-report",
    "test:ui:critical": "playwright test --grep '@critical'",
    "test:ui:mobile": "playwright test --project='Mobile Chrome'",
    "test:ui:accessibility": "playwright test tests/ui/accessibility/"
  }
}
```

### Continuous Integration
```yaml
# File: .github/workflows/ui-tests.yml

name: UI Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  ui-tests:
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
    
    - name: Install Playwright
      run: npx playwright install --with-deps
    
    - name: Start application
      run: npm run build && npm run start &
      
    - name: Wait for app to be ready
      run: npx wait-on http://localhost:3000
    
    - name: Run UI tests
      run: npm run test:ui
      
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
```

---

**Test Execution Schedule:**
- **Critical Flows:** Before every release
- **Full UI Suite:** Weekly (Sunday nights)
- **Performance Tests:** Weekly
- **Accessibility Tests:** Monthly
- **Visual Regression:** On UI changes

**Coverage Goals:**
- **Critical Paths:** 100% automated
- **Feature Coverage:** 90% automated  
- **Cross-browser:** Chrome, Firefox, Safari, Edge
- **Mobile Coverage:** iOS Safari, Android Chrome

**Last Updated:** February 7, 2026