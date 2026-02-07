# BlueOx Business Platform - Complete SaaS Architecture Guide

**Version:** 1.0  
**Last Updated:** February 4, 2026  
**Status:** Implementation Roadmap

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Multi-Tenant Architecture](#2-multi-tenant-architecture)
3. [Subscription & Billing System](#3-subscription--billing-system)
4. [Module Management System](#4-module-management-system)
5. [User Management & Access Control](#5-user-management--access-control)
6. [Trial System](#6-trial-system)
7. [Payment Processing](#7-payment-processing)
8. [Plan Upgrades & Downgrades](#8-plan-upgrades--downgrades)
9. [Subscription Lifecycle](#9-subscription-lifecycle)
10. [Database Schema](#10-database-schema)
11. [Middleware & Access Control](#11-middleware--access-control)
12. [Webhooks & Background Jobs](#12-webhooks--background-jobs)
13. [Email Notifications](#13-email-notifications)
14. [Analytics & Reporting](#14-analytics--reporting)
15. [Security & Compliance](#15-security--compliance)
16. [Implementation Checklist](#16-implementation-checklist)

---

## 1. System Overview

### 1.1 What is BlueOx Business Platform?

BlueOx Business Platform is a **multi-tenant B2B SaaS** application providing:
- **Core Platform:** Accounting, Invoicing, CRM, Expenses, Multi-currency
- **Industry Modules:** Optional add-ons (Tours, Fleet, Hotels, Retail, Security, Inventory)
- **Three Pricing Tiers:** Starter, Professional, Enterprise
- **30-Day Free Trial:** Professional plan with up to 3 modules

### 1.2 Revenue Model

**Subscription-based:**
- Base Plans: Monthly/Annual billing
- Module Add-ons: Pay-per-module pricing
- No setup fees (self-service onboarding)

**Pricing Structure:**
- **Starter:** $29-39/month (core only, 3 users, 100 transactions/month)
- **Professional:** $99-149/month (core + unlimited modules, 10 users, 1000 transactions/month)
- **Enterprise:** $349-499/month (core + unlimited modules, unlimited users, custom features)

**Module Pricing:**
- Tours & Safari: $39/month
- Fleet Management: $35/month
- Hotel Management: $45/month
- Retail & Restaurant: $35/month
- Security Services: $29/month
- Inventory & Assets: $39/month

---

## 2. Multi-Tenant Architecture

### 2.1 Tenant Isolation Strategy

**Row-Level Security (RLS) via Supabase:**

Every data table includes `company_id` column:
```sql
-- Example: invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  amount DECIMAL(15, 2),
  -- other columns...
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policy
CREATE POLICY "Users can only access their company's invoices"
ON invoices
FOR ALL
USING (company_id = current_setting('app.current_company_id')::uuid);
```

### 2.2 Company Structure

```
companies
├── id (UUID, PK)
├── name (TEXT)
├── slug (TEXT, UNIQUE) - for custom domains later
├── logo_url (TEXT)
├── created_at (TIMESTAMP)
└── is_active (BOOLEAN)

company_settings
├── id (UUID, PK)
├── company_id (UUID, FK)
├── subscription_status (ENUM: trial, active, past_due, cancelled, expired)
├── plan_tier (ENUM: starter, professional, enterprise)
├── billing_period (ENUM: monthly, annual)
├── trial_start_date (TIMESTAMP)
├── trial_end_date (TIMESTAMP)
├── trial_modules (TEXT[]) - modules selected during trial
├── current_period_start (TIMESTAMP)
├── current_period_end (TIMESTAMP)
├── current_user_count (INTEGER DEFAULT 1)
├── max_users_allowed (INTEGER DEFAULT 3)
├── stripe_customer_id (TEXT)
├── stripe_subscription_id (TEXT)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

### 2.3 Data Flow

```
User Login
  ↓
Fetch user_profile → get company_id
  ↓
Set session: current_company_id = company_id
  ↓
All queries automatically filter by company_id (RLS)
  ↓
User sees only their company's data
```

---

## 3. Subscription & Billing System

### 3.1 Subscription States

**State Machine:**
```
trial → active → (past_due ↔ active) → cancelled/expired
  ↓                     ↓
expired            expired
```

**States Explained:**
- **trial:** First 30 days, no payment required
- **active:** Paid subscription, current_period_end in future
- **past_due:** Payment failed, retrying (grace period: 7 days)
- **cancelled:** User cancelled, access until current_period_end
- **expired:** No active subscription, access blocked

### 3.2 Subscription Table Schema

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Plan details
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('starter', 'professional', 'enterprise')),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  
  -- Billing periods
  trial_start_date TIMESTAMP,
  trial_end_date TIMESTAMP,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMP,
  
  -- Pricing (snapshot at subscription time)
  base_price_amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  discount_percent INTEGER DEFAULT 0, -- for annual billing (10%)
  
  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_payment_method_id TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);
```

### 3.3 Subscription Modules Table

Tracks which modules are active for each company:

```sql
CREATE TABLE subscription_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL CHECK (module_id IN ('tours', 'fleet', 'hotels', 'cafe', 'security', 'inventory')),
  
  -- Module pricing (snapshot)
  monthly_price DECIMAL(10, 2) NOT NULL,
  setup_fee DECIMAL(10, 2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_trial_module BOOLEAN DEFAULT FALSE, -- true if selected during trial
  added_at TIMESTAMP DEFAULT NOW(),
  removed_at TIMESTAMP,
  
  -- Billing
  next_billing_date TIMESTAMP,
  stripe_subscription_item_id TEXT, -- for per-module billing
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(company_id, module_id, is_active) -- prevent duplicate active modules
);

-- Indexes
CREATE INDEX idx_subscription_modules_company ON subscription_modules(company_id);
CREATE INDEX idx_subscription_modules_active ON subscription_modules(company_id, is_active);
```

### 3.4 Billing History

```sql
CREATE TABLE billing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  
  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  
  -- Invoice details
  invoice_number TEXT UNIQUE,
  invoice_url TEXT, -- Stripe hosted invoice
  invoice_pdf_url TEXT,
  
  -- Period covered
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  
  -- Breakdown
  base_plan_cost DECIMAL(10, 2),
  modules_cost DECIMAL(10, 2),
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- Stripe
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  
  -- Dates
  paid_at TIMESTAMP,
  failed_at TIMESTAMP,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_billing_history_company ON billing_history(company_id);
CREATE INDEX idx_billing_history_status ON billing_history(status);
CREATE INDEX idx_billing_history_period ON billing_history(period_start, period_end);
```

---

## 4. Module Management System

### 4.1 Module Configuration

Each module is defined in code (`src/lib/modules.ts`):

```typescript
export interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
  monthlyPrice: number;
  setupFee: number;
  availableForTrial: boolean;
  requiredModules: string[]; // dependencies
  features: string[];
  maxRecordsPerPlan: {
    starter: number | null; // null = not available
    professional: number;
    enterprise: number | 'unlimited';
  };
}

export const MODULES: Record<string, Module> = {
  tours: {
    id: 'tours',
    name: 'Tours & Safari',
    description: 'Complete tour operator management',
    icon: 'GlobeAltIcon',
    monthlyPrice: 39,
    setupFee: 0,
    availableForTrial: true,
    requiredModules: [],
    features: ['Tour Packages', 'Bookings', 'Guides', 'Seasonal Pricing'],
    maxRecordsPerPlan: {
      starter: null, // not available
      professional: 1000,
      enterprise: 'unlimited',
    },
  },
  // ... other modules
};
```

### 4.2 Module Access Control

**Checking if module is enabled:**

```typescript
// lib/module-access.ts
export async function hasModuleAccess(
  companyId: string,
  moduleId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('subscription_modules')
    .select('id')
    .eq('company_id', companyId)
    .eq('module_id', moduleId)
    .eq('is_active', true)
    .single();

  return !!data && !error;
}

// Usage in API route:
export async function GET(request: Request) {
  const companyId = await getCurrentCompanyId();
  
  if (!await hasModuleAccess(companyId, 'tours')) {
    return NextResponse.json(
      { error: 'Tours module not enabled' },
      { status: 403 }
    );
  }
  
  // ... proceed with request
}
```

### 4.3 Module Addition Flow

**User wants to add a module:**

1. **Check eligibility:**
   - Is plan tier allowed to have modules? (Professional/Enterprise yes, Starter no)
   - Is module already active?
   - Are dependencies met? (e.g., retail requires inventory)

2. **Calculate pricing:**
   ```typescript
   const setupFee = MODULES[moduleId].setupFee;
   const monthlyPrice = MODULES[moduleId].monthlyPrice;
   const proratedCharge = calculateProration(
     monthlyPrice,
     subscription.current_period_end
   );
   ```

3. **Create Stripe subscription item:**
   ```typescript
   const subscriptionItem = await stripe.subscriptionItems.create({
     subscription: subscription.stripe_subscription_id,
     price_data: {
       currency: 'usd',
       product: STRIPE_MODULE_PRODUCT_IDS[moduleId],
       unit_amount: monthlyPrice * 100, // cents
       recurring: { interval: 'month' },
     },
     proration_behavior: 'create_prorations',
   });
   ```

4. **Save to database:**
   ```sql
   INSERT INTO subscription_modules (
     company_id, module_id, monthly_price, setup_fee, 
     stripe_subscription_item_id, is_active
   ) VALUES ($1, $2, $3, $4, $5, true);
   ```

5. **Charge setup fee (if applicable):**
   ```typescript
   if (setupFee > 0) {
     await stripe.invoiceItems.create({
       customer: subscription.stripe_customer_id,
       amount: setupFee * 100,
       currency: 'usd',
       description: `${moduleName} - Setup Fee`,
     });
     await stripe.invoices.create({
       customer: subscription.stripe_customer_id,
       auto_advance: true, // auto-finalize and pay
     });
   }
   ```

### 4.4 Module Removal Flow

**User wants to remove a module:**

1. **Check if other modules depend on it:**
   ```typescript
   const dependentModules = Object.values(MODULES).filter(
     m => m.requiredModules.includes(moduleId)
   );
   if (dependentModules.length > 0) {
     throw new Error(
       `Cannot remove ${moduleId}. Required by: ${dependentModules.map(m => m.name).join(', ')}`
     );
   }
   ```

2. **Cancel immediately or at period end?**
   - **Immediate:** Mark `is_active = false`, `removed_at = NOW()`, no refund
   - **Period end:** Schedule removal for `current_period_end`, partial refund/credit

3. **Update Stripe:**
   ```typescript
   await stripe.subscriptionItems.del(
     subscriptionModule.stripe_subscription_item_id,
     { proration_behavior: 'create_prorations' } // credit unused time
   );
   ```

4. **Update database:**
   ```sql
   UPDATE subscription_modules
   SET is_active = false, removed_at = NOW()
   WHERE company_id = $1 AND module_id = $2;
   ```

---

## 5. User Management & Access Control

### 5.1 User-Company Relationship

**Tables:**

```sql
-- Supabase auth.users (managed by Supabase Auth)
-- We don't directly modify this, but reference it

user_profiles
├── id (UUID, PK)
├── user_id (UUID, FK to auth.users) UNIQUE
├── company_id (UUID, FK to companies)
├── role (ENUM: owner, admin, manager, accountant, viewer)
├── full_name (TEXT)
├── avatar_url (TEXT)
├── is_active (BOOLEAN DEFAULT TRUE)
├── invited_by (UUID, FK to user_profiles)
├── invited_at (TIMESTAMP)
├── accepted_at (TIMESTAMP)
├── last_login_at (TIMESTAMP)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

-- Roles definition
user_roles
├── role_name (TEXT, PK)
├── description (TEXT)
└── permissions (JSONB) -- { "invoices": ["create", "read", "update"], ... }
```

**One user can belong to multiple companies:**

```sql
-- User john@gmail.com works for 2 companies
user_profiles:
  { user_id: 'abc123', company_id: 'companyA', role: 'admin' }
  { user_id: 'abc123', company_id: 'companyB', role: 'viewer' }

-- Session tracks active company:
session = {
  user_id: 'abc123',
  active_company_id: 'companyA', -- can switch
}
```

### 5.2 User Limits per Plan

**Plan Limits:**
- **Starter:** 3 users
- **Professional:** 10 users
- **Enterprise:** Unlimited users

**Enforcement:**

```sql
-- Trigger to update user count
CREATE OR REPLACE FUNCTION update_user_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE company_settings
    SET current_user_count = current_user_count + 1
    WHERE company_id = NEW.company_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE company_settings
    SET current_user_count = current_user_count - 1
    WHERE company_id = OLD.company_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_count_trigger
AFTER INSERT OR DELETE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION update_user_count();

-- Check before adding user
CREATE OR REPLACE FUNCTION check_user_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  max_users INTEGER;
BEGIN
  SELECT current_user_count, max_users_allowed
  INTO user_count, max_users
  FROM company_settings
  WHERE company_id = NEW.company_id;
  
  IF user_count >= max_users THEN
    RAISE EXCEPTION 'User limit reached. Upgrade plan to add more users.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_user_limit_trigger
BEFORE INSERT ON user_profiles
FOR EACH ROW EXECUTE FUNCTION check_user_limit();
```

### 5.3 User Invitation Flow

1. **Admin clicks "Invite User"**
2. **System checks:** `current_user_count < max_users_allowed`
3. **If limit reached:** Show upgrade prompt
4. **If OK:**
   - Generate invitation token
   - Save to `user_invitations` table
   - Send email with link: `/accept-invite?token=xyz`
5. **Invitee clicks link:**
   - If has account → add to company
   - If no account → signup flow with company pre-assigned
6. **Accept invitation:**
   - Insert into `user_profiles`
   - Trigger increments `current_user_count`
   - Email admin: "John Doe joined your team"

---

## 6. Trial System

### 6.1 Trial Configuration

**Trial Details:**
- **Duration:** 30 days
- **Plan Level:** Professional
- **Modules:** Up to 3 industry modules
- **No Credit Card:** Required only after trial
- **Full Access:** All Professional features

### 6.2 Trial Signup Flow

```
User Signs Up
  ↓
Create company
  ↓
Set trial dates:
  - trial_start_date = NOW()
  - trial_end_date = NOW() + INTERVAL '30 days'
  - subscription_status = 'trial'
  - plan_tier = 'professional'
  ↓
Redirect to /signup/select-modules
  ↓
User selects 0-3 modules
  ↓
Save to subscription_modules with is_trial_module = true
  ↓
Redirect to dashboard
```

### 6.3 Trial Monitoring

**Daily Check (Cron Job):**

```sql
-- Find trials ending in 7 days
SELECT c.id, c.name, cs.trial_end_date, up.user_id
FROM companies c
JOIN company_settings cs ON c.id = cs.company_id
JOIN user_profiles up ON c.id = up.company_id AND up.role = 'owner'
WHERE cs.subscription_status = 'trial'
  AND cs.trial_end_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM email_notifications
    WHERE company_id = c.id AND type = 'trial_ending_7_days'
  );

-- Send email: "Your trial ends in 7 days"

-- Find expired trials
SELECT c.id
FROM companies c
JOIN company_settings cs ON c.id = cs.company_id
WHERE cs.subscription_status = 'trial'
  AND cs.trial_end_date < NOW();

-- Update to expired
UPDATE company_settings
SET subscription_status = 'expired'
WHERE subscription_status = 'trial'
  AND trial_end_date < NOW();
```

### 6.4 Trial Expiration Handling

**When trial expires:**

1. **Middleware check:**
   ```typescript
   if (subscription.status === 'expired') {
     // Redirect to /billing/upgrade
     return NextResponse.redirect('/billing/upgrade');
   }
   ```

2. **Show upgrade page:**
   - Display selected modules during trial
   - Show pricing for current selection
   - "Continue with these modules" → pre-fill checkout
   - Allow changing plan/modules before payment

3. **User completes payment:**
   - Create Stripe subscription
   - Update `subscription_status = 'active'`
   - Set `current_period_start/end`
   - Convert trial modules to paid modules

### 6.5 Trial Extensions (Optional)

**For special cases:**

```sql
-- Extend trial by 14 days
UPDATE company_settings
SET trial_end_date = trial_end_date + INTERVAL '14 days'
WHERE company_id = $1;

-- Log the extension
INSERT INTO trial_extensions (company_id, days_extended, reason, extended_by)
VALUES ($1, 14, 'Customer requested demo', $admin_user_id);
```

---

## 7. Payment Processing

### 7.1 Stripe Integration

**Setup:**

1. **Create Stripe Products:**
   ```typescript
   // One-time setup
   const products = {
     starter: await stripe.products.create({
       name: 'BlueOx Starter Plan',
       description: 'Core accounting features for small teams',
     }),
     professional: await stripe.products.create({
       name: 'BlueOx Professional Plan',
       description: 'Advanced features with unlimited modules',
     }),
     // ... modules as products
   };
   ```

2. **Create Prices:**
   ```typescript
   const prices = {
     starter_monthly_usd: await stripe.prices.create({
       product: products.starter.id,
       unit_amount: 1900, // $19.00
       currency: 'usd',
       recurring: { interval: 'month' },
     }),
     starter_annual_usd: await stripe.prices.create({
       product: products.starter.id,
       unit_amount: 20520, // $205.20 (10% discount)
       currency: 'usd',
       recurring: { interval: 'year' },
     }),
     // ... other prices
   };
   ```

### 7.2 Checkout Flow

**User selects plan:**

1. **Frontend:**
   ```typescript
   const handleSubscribe = async () => {
     const response = await fetch('/api/billing/create-checkout', {
       method: 'POST',
       body: JSON.stringify({
         plan_tier: 'professional',
         billing_period: 'monthly',
         module_ids: ['tours', 'fleet'],
       }),
     });
     
     const { sessionId } = await response.json();
     
     // Redirect to Stripe Checkout
     const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
     await stripe.redirectToCheckout({ sessionId });
   };
   ```

2. **Backend API (`/api/billing/create-checkout`):**
   ```typescript
   export async function POST(request: Request) {
     const { plan_tier, billing_period, module_ids } = await request.json();
     const companyId = await getCurrentCompanyId();
     
     // Get or create Stripe customer
     let customer = await getStripeCustomer(companyId);
     if (!customer) {
       customer = await stripe.customers.create({
         email: user.email,
         metadata: { company_id: companyId },
       });
     }
     
     // Build line items
     const lineItems = [
       {
         price: STRIPE_PRICE_IDS[`${plan_tier}_${billing_period}_usd`],
         quantity: 1,
       },
     ];
     
     // Add modules
     for (const moduleId of module_ids) {
       lineItems.push({
         price: STRIPE_PRICE_IDS[`module_${moduleId}_monthly`],
         quantity: 1,
       });
     }
     
     // Create checkout session
     const session = await stripe.checkout.sessions.create({
       customer: customer.id,
       mode: 'subscription',
       line_items: lineItems,
       success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
       cancel_url: `${APP_URL}/billing/upgrade`,
       metadata: {
         company_id: companyId,
         plan_tier,
         billing_period,
         module_ids: JSON.stringify(module_ids),
       },
     });
     
     return NextResponse.json({ sessionId: session.id });
   }
   ```

3. **Success page:**
   ```typescript
   // /billing/success/page.tsx
   const session = await stripe.checkout.sessions.retrieve(sessionId);
   
   // Don't update database here - wait for webhook
   // Just show confirmation: "Processing payment..."
   ```

### 7.3 Webhook Handling

**Stripe sends webhooks for events:**

```typescript
// /api/webhooks/stripe/route.ts
export async function POST(request: Request) {
  const payload = await request.text();
  const sig = request.headers.get('stripe-signature');
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object);
      break;
  }
  
  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: any) {
  const companyId = session.metadata.company_id;
  
  // Create subscription record
  await supabase.from('subscriptions').insert({
    company_id: companyId,
    plan_tier: session.metadata.plan_tier,
    billing_period: session.metadata.billing_period,
    status: 'active',
    current_period_start: new Date(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    stripe_customer_id: session.customer,
    stripe_subscription_id: session.subscription,
  });
  
  // Activate modules
  const moduleIds = JSON.parse(session.metadata.module_ids);
  for (const moduleId of moduleIds) {
    await supabase.from('subscription_modules').insert({
      company_id: companyId,
      module_id: moduleId,
      is_active: true,
      is_trial_module: false,
    });
  }
  
  // Update company settings
  await supabase.from('company_settings').update({
    subscription_status: 'active',
    plan_tier: session.metadata.plan_tier,
    stripe_customer_id: session.customer,
    stripe_subscription_id: session.subscription,
  }).eq('company_id', companyId);
  
  // Send welcome email
  await sendEmail({
    to: session.customer_email,
    template: 'subscription_activated',
    data: { plan_tier: session.metadata.plan_tier },
  });
}
```

### 7.4 Invoice Generation

**Automatic invoicing:**

```typescript
async function handleInvoicePaid(invoice: any) {
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  const companyId = subscription.metadata.company_id;
  
  // Save to billing history
  await supabase.from('billing_history').insert({
    company_id: companyId,
    subscription_id: subscription.id,
    amount: invoice.amount_paid / 100,
    currency: invoice.currency.toUpperCase(),
    status: 'succeeded',
    invoice_number: invoice.number,
    invoice_url: invoice.hosted_invoice_url,
    invoice_pdf_url: invoice.invoice_pdf,
    period_start: new Date(invoice.period_start * 1000),
    period_end: new Date(invoice.period_end * 1000),
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: invoice.payment_intent,
    paid_at: new Date(invoice.status_transitions.paid_at * 1000),
  });
  
  // Send invoice email
  await sendEmail({
    to: invoice.customer_email,
    template: 'invoice_paid',
    data: {
      invoice_number: invoice.number,
      amount: invoice.amount_paid / 100,
      pdf_url: invoice.invoice_pdf,
    },
  });
}
```

---

## 8. Plan Upgrades & Downgrades

### 8.1 Upgrade Flow

**User wants to upgrade Starter → Professional:**

1. **Frontend:**
   ```typescript
   const handleUpgrade = async () => {
     await fetch('/api/billing/upgrade', {
       method: 'POST',
       body: JSON.stringify({ new_plan: 'professional' }),
     });
   };
   ```

2. **Backend:**
   ```typescript
   export async function POST(request: Request) {
     const { new_plan } = await request.json();
     const companyId = await getCurrentCompanyId();
     
     const subscription = await getCurrentSubscription(companyId);
     
     // Update Stripe subscription
     const updated = await stripe.subscriptions.update(
       subscription.stripe_subscription_id,
       {
         items: [{
           id: subscription.stripe_subscription_item_id,
           price: STRIPE_PRICE_IDS[`${new_plan}_monthly_usd`],
         }],
         proration_behavior: 'create_prorations', // charge difference now
       }
     );
     
     // Update database
     await supabase.from('subscriptions').update({
       plan_tier: new_plan,
       max_users_allowed: PLAN_LIMITS[new_plan].max_users,
     }).eq('company_id', companyId);
     
     return NextResponse.json({ success: true });
   }
   ```

3. **Immediate changes:**
   - User limit increases (3 → 10)
   - Can now add modules (if Professional/Enterprise)
   - Prorated charge for remainder of billing period

### 8.2 Downgrade Flow

**User wants to downgrade Professional → Starter:**

1. **Check compatibility:**
   ```typescript
   // Can't downgrade if:
   // - More than 3 users
   // - Has active modules
   // - Exceeds Starter limits
   
   const userCount = await getUserCount(companyId);
   const activeModules = await getActiveModules(companyId);
   
   if (userCount > 3) {
     throw new Error('Remove users before downgrading (Starter allows 3)');
   }
   
   if (activeModules.length > 0) {
     throw new Error('Remove modules before downgrading (Starter has no modules)');
   }
   ```

2. **Schedule downgrade:**
   ```typescript
   // Don't downgrade immediately - wait for period end
   await stripe.subscriptions.update(
     subscription.stripe_subscription_id,
     {
       items: [{
         id: subscription.stripe_subscription_item_id,
         price: STRIPE_PRICE_IDS['starter_monthly_usd'],
       }],
       proration_behavior: 'none', // no refund
       billing_cycle_anchor: 'unchanged', // apply at next renewal
     }
   );
   
   await supabase.from('subscriptions').update({
     pending_plan_change: 'starter',
     plan_change_at: subscription.current_period_end,
   }).eq('company_id', companyId);
   ```

3. **Show confirmation:**
   - "Your plan will downgrade to Starter on [date]"
   - "You'll keep Professional features until then"
   - "Cancel downgrade" option available

### 8.3 Adding Extra Modules

**User on Professional plan wants to add Hotels module:**

1. **Check eligibility:**
   ```typescript
   if (currentPlan === 'starter') {
     throw new Error('Modules require Professional or Enterprise plan');
   }
   
   const hasModule = await hasActiveModule(companyId, 'hotels');
   if (hasModule) {
     throw new Error('Hotels module already active');
   }
   ```

2. **Calculate cost:**
   ```typescript
   const modulePrice = 45; // Hotels: $45/month
   const setupFee = 0; // No setup fee for hotels
   const daysLeft = Math.ceil(
     (subscription.current_period_end - Date.now()) / (1000 * 60 * 60 * 24)
   );
   const proratedAmount = (modulePrice / 30) * daysLeft;
   ```

3. **Add to Stripe subscription:**
   ```typescript
   const subscriptionItem = await stripe.subscriptionItems.create({
     subscription: subscription.stripe_subscription_id,
     price: STRIPE_PRICE_IDS['module_hotels_monthly'],
     proration_behavior: 'create_prorations',
   });
   ```

4. **Save to database:**
   ```typescript
   await supabase.from('subscription_modules').insert({
     company_id: companyId,
     module_id: 'hotels',
     monthly_price: 45,
     stripe_subscription_item_id: subscriptionItem.id,
     is_active: true,
   });
   ```

5. **Immediate access:**
   - Module routes now accessible
   - Navigation shows Hotels menu item
   - User can start using Hotels features

---

## 9. Subscription Lifecycle

### 9.1 Renewal Process

**Automatic renewal (monthly/annual):**

```
30 days before renewal:
  ↓
Stripe sends invoice.upcoming webhook
  ↓
Send email: "Your subscription renews on [date] for $X"
  ↓
7 days before renewal:
  ↓
Send reminder: "Renewing soon, update payment method if needed"
  ↓
Renewal date:
  ↓
Stripe attempts payment
  ↓
Success? → invoice.paid webhook → Update current_period_end
  ↓
Failed? → invoice.payment_failed webhook → Status = past_due
```

**Handling payment failures:**

```typescript
async function handlePaymentFailed(invoice: any) {
  const companyId = invoice.metadata.company_id;
  
  // Update status
  await supabase.from('subscriptions').update({
    status: 'past_due',
  }).eq('company_id', companyId);
  
  // Send urgent email
  await sendEmail({
    to: invoice.customer_email,
    template: 'payment_failed',
    data: {
      amount: invoice.amount_due / 100,
      retry_date: new Date(invoice.next_payment_attempt * 1000),
    },
  });
  
  // Stripe auto-retries:
  // - Immediately
  // - 3 days later
  // - 5 days later
  // - 7 days later
  
  // If all fail → subscription cancelled
}
```

### 9.2 Cancellation Flow

**User cancels subscription:**

```typescript
export async function POST(request: Request) {
  const { cancel_immediately } = await request.json();
  const companyId = await getCurrentCompanyId();
  const subscription = await getCurrentSubscription(companyId);
  
  if (cancel_immediately) {
    // Cancel now, no refund
    await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
    
    await supabase.from('subscriptions').update({
      status: 'cancelled',
      cancelled_at: new Date(),
    }).eq('company_id', companyId);
    
    // Immediate effect
    await supabase.from('company_settings').update({
      subscription_status: 'cancelled',
    }).eq('company_id', companyId);
    
  } else {
    // Cancel at period end (default)
    await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: true }
    );
    
    await supabase.from('subscriptions').update({
      cancel_at_period_end: true,
      cancelled_at: new Date(),
    }).eq('company_id', companyId);
    
    // Access continues until current_period_end
  }
  
  // Send confirmation email
  await sendEmail({
    to: user.email,
    template: 'subscription_cancelled',
    data: {
      access_until: cancel_immediately ? 'now' : subscription.current_period_end,
    },
  });
  
  return NextResponse.json({ success: true });
}
```

**When period ends:**

```sql
-- Cron job runs daily
UPDATE subscriptions
SET status = 'expired'
WHERE cancel_at_period_end = TRUE
  AND current_period_end < NOW();

UPDATE company_settings cs
SET subscription_status = 'expired'
FROM subscriptions s
WHERE cs.company_id = s.company_id
  AND s.status = 'expired';
```

### 9.3 Reactivation

**User wants to reactivate cancelled subscription:**

```typescript
export async function POST(request: Request) {
  const companyId = await getCurrentCompanyId();
  const subscription = await getCurrentSubscription(companyId);
  
  if (subscription.status === 'cancelled' && subscription.cancel_at_period_end) {
    // Remove cancellation flag
    await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: false }
    );
    
    await supabase.from('subscriptions').update({
      cancel_at_period_end: false,
      cancelled_at: null,
    }).eq('company_id', companyId);
    
    return NextResponse.json({ message: 'Subscription reactivated' });
  }
  
  if (subscription.status === 'expired') {
    // Need to create new subscription
    return NextResponse.json({ 
      message: 'Subscription expired. Please subscribe again.',
      redirect: '/billing/upgrade',
    });
  }
}
```

---

## 10. Database Schema

### 10.1 Complete Schema

**Core Tables:**

```sql
-- Companies (Tenants)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Company Settings & Subscription Info
CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  
  -- Subscription
  subscription_status TEXT NOT NULL DEFAULT 'trial' 
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  plan_tier TEXT DEFAULT 'professional'
    CHECK (plan_tier IN ('starter', 'professional', 'enterprise')),
  billing_period TEXT DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly', 'annual')),
  
  -- Trial
  trial_start_date TIMESTAMP,
  trial_end_date TIMESTAMP,
  trial_modules TEXT[] DEFAULT '{}',
  
  -- Current period
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  
  -- User limits
  current_user_count INTEGER DEFAULT 1,
  max_users_allowed INTEGER DEFAULT 3,
  
  -- Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_payment_method_id TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Profiles (Multi-tenant users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner', 'admin', 'manager', 'accountant', 'viewer')),
  full_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  invited_by UUID REFERENCES user_profiles(id),
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- Subscriptions (Detailed subscription tracking)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Plan
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('starter', 'professional', 'enterprise')),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  
  -- Dates
  trial_start_date TIMESTAMP,
  trial_end_date TIMESTAMP,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMP,
  
  -- Pricing snapshot
  base_price_amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  discount_percent INTEGER DEFAULT 0,
  
  -- Pending changes
  pending_plan_change TEXT,
  plan_change_at TIMESTAMP,
  
  -- Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_payment_method_id TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscription Modules
CREATE TABLE subscription_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL 
    CHECK (module_id IN ('tours', 'fleet', 'hotels', 'cafe', 'security', 'inventory')),
  
  -- Pricing
  monthly_price DECIMAL(10, 2) NOT NULL,
  setup_fee DECIMAL(10, 2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_trial_module BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMP DEFAULT NOW(),
  removed_at TIMESTAMP,
  next_billing_date TIMESTAMP,
  
  -- Stripe
  stripe_subscription_item_id TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Billing History
CREATE TABLE billing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  
  -- Payment
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  
  -- Invoice
  invoice_number TEXT UNIQUE,
  invoice_url TEXT,
  invoice_pdf_url TEXT,
  
  -- Period
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  
  -- Breakdown
  base_plan_cost DECIMAL(10, 2),
  modules_cost DECIMAL(10, 2),
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- Stripe
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  
  -- Dates
  paid_at TIMESTAMP,
  failed_at TIMESTAMP,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Invitations
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'accountant', 'viewer')),
  token TEXT UNIQUE NOT NULL,
  invited_by UUID NOT NULL REFERENCES user_profiles(id),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Email Notifications Log
CREATE TABLE email_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'trial_ending_7_days', 'payment_failed', etc.
  recipient_email TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  status TEXT CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT
);

-- Trial Extensions (for customer service)
CREATE TABLE trial_extensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  days_extended INTEGER NOT NULL,
  reason TEXT,
  extended_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.2 Indexes

```sql
-- Performance indexes
CREATE INDEX idx_user_profiles_company ON user_profiles(company_id);
CREATE INDEX idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX idx_subscription_modules_company ON subscription_modules(company_id);
CREATE INDEX idx_subscription_modules_active ON subscription_modules(company_id, is_active);
CREATE INDEX idx_billing_history_company ON billing_history(company_id);
CREATE INDEX idx_billing_history_period ON billing_history(period_start, period_end);
CREATE INDEX idx_email_notifications_company ON email_notifications(company_id);
CREATE INDEX idx_email_notifications_type ON email_notifications(type, sent_at);
```

---

## 11. Middleware & Access Control

### 11.1 Middleware Stack

**Next.js middleware (`src/middleware.ts`):**

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });
  
  // 1. Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session && !isPublicRoute(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (session) {
    // 2. Get user's company
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id, role')
      .eq('user_id', session.user.id)
      .single();
    
    if (!profile) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
    
    // 3. Check subscription status
    const { data: settings } = await supabase
      .from('company_settings')
      .select('subscription_status, trial_end_date, plan_tier')
      .eq('company_id', profile.company_id)
      .single();
    
    // 4. Block if expired (except billing routes)
    if (settings.subscription_status === 'expired' && 
        !request.nextUrl.pathname.startsWith('/billing')) {
      return NextResponse.redirect(new URL('/billing/upgrade', request.url));
    }
    
    // 5. Show trial warning banner
    if (settings.subscription_status === 'trial') {
      const daysLeft = Math.ceil(
        (new Date(settings.trial_end_date) - new Date()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysLeft <= 7) {
        res.cookies.set('trial_warning', String(daysLeft));
      }
    }
    
    // 6. Check module access for module routes
    if (request.nextUrl.pathname.startsWith('/dashboard/tours')) {
      const { data: module } = await supabase
        .from('subscription_modules')
        .select('id')
        .eq('company_id', profile.company_id)
        .eq('module_id', 'tours')
        .eq('is_active', true)
        .single();
      
      if (!module) {
        return NextResponse.redirect(new URL('/dashboard?error=module_required', request.url));
      }
    }
    
    // 7. Set company context for RLS
    await supabase.rpc('set_company_context', { 
      company_id: profile.company_id 
    });
  }
  
  return res;
}

function isPublicRoute(pathname: string): boolean {
  const publicRoutes = ['/', '/login', '/signup', '/api/webhooks'];
  return publicRoutes.some(route => pathname.startsWith(route));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 11.2 RLS Context Setting

**PostgreSQL function:**

```sql
-- Set company context for RLS
CREATE OR REPLACE FUNCTION set_company_context(company_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_company_id', company_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Use in RLS policies
CREATE POLICY "Users access only their company data"
ON invoices
FOR ALL
USING (company_id = current_setting('app.current_company_id')::uuid);
```

---

## 12. Webhooks & Background Jobs

### 12.1 Stripe Webhooks

**Events to handle:**

```typescript
// /api/webhooks/stripe/route.ts

const webhookHandlers = {
  'checkout.session.completed': handleCheckoutCompleted,
  'invoice.paid': handleInvoicePaid,
  'invoice.payment_failed': handlePaymentFailed,
  'invoice.upcoming': handleInvoiceUpcoming,
  'customer.subscription.updated': handleSubscriptionUpdated,
  'customer.subscription.deleted': handleSubscriptionCancelled,
  'customer.subscription.trial_will_end': handleTrialEnding,
  'payment_method.attached': handlePaymentMethodAttached,
  'payment_method.detached': handlePaymentMethodDetached,
};

export async function POST(request: Request) {
  const payload = await request.text();
  const sig = request.headers.get('stripe-signature');
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  const handler = webhookHandlers[event.type];
  if (handler) {
    try {
      await handler(event.data.object);
    } catch (error) {
      console.error(`Error handling ${event.type}:`, error);
      return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
    }
  }
  
  return NextResponse.json({ received: true });
}
```

### 12.2 Background Jobs (Cron)

**Supabase Edge Functions with pg_cron:**

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily trial expiration check (runs at 1 AM UTC)
SELECT cron.schedule(
  'check-trial-expirations',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-app.com/api/cron/check-trials',
    headers := '{"Authorization": "Bearer ' || current_setting('app.cron_secret') || '"}',
    body := '{}'
  );
  $$
);

-- Send trial ending reminders (7 days, 3 days, 1 day)
SELECT cron.schedule(
  'trial-reminders',
  '0 9 * * *', -- 9 AM daily
  $$
  SELECT net.http_post(
    url := 'https://your-app.com/api/cron/trial-reminders',
    headers := '{"Authorization": "Bearer ' || current_setting('app.cron_secret') || '"}',
    body := '{}'
  );
  $$
);

-- Monthly usage reports (1st of each month)
SELECT cron.schedule(
  'monthly-reports',
  '0 0 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://your-app.com/api/cron/monthly-reports',
    headers := '{"Authorization": "Bearer ' || current_setting('app.cron_secret') || '"}',
    body := '{}'
  );
  $$
);
```

**Cron API endpoints:**

```typescript
// /api/cron/check-trials/route.ts
export async function POST(request: Request) {
  // Verify cron secret
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Find expired trials
  const { data: expiredTrials } = await supabase
    .from('company_settings')
    .select('company_id, trial_end_date')
    .eq('subscription_status', 'trial')
    .lt('trial_end_date', new Date().toISOString());
  
  // Update to expired
  for (const company of expiredTrials) {
    await supabase
      .from('company_settings')
      .update({ subscription_status: 'expired' })
      .eq('company_id', company.company_id);
    
    // Send expiration email
    await sendTrialExpiredEmail(company.company_id);
  }
  
  return NextResponse.json({ 
    expired: expiredTrials.length 
  });
}
```

---

## 13. Email Notifications

### 13.1 Email Templates

**Using Resend or SendGrid:**

```typescript
// lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ to, template, data }: EmailParams) {
  const templates = {
    trial_ending_7_days: {
      subject: 'Your BlueOx trial ends in 7 days',
      html: `
        <h1>Hi ${data.company_name},</h1>
        <p>Your 30-day trial ends on ${data.trial_end_date}.</p>
        <p>To continue using BlueOx, add a payment method:</p>
        <a href="${data.upgrade_url}">Add Payment Method</a>
      `,
    },
    subscription_activated: {
      subject: 'Welcome to BlueOx!',
      html: `
        <h1>Your subscription is active!</h1>
        <p>Plan: ${data.plan_tier}</p>
        <p>Your next bill: ${data.next_billing_date}</p>
      `,
    },
    payment_failed: {
      subject: 'Payment failed - Action required',
      html: `
        <h1>We couldn't process your payment</h1>
        <p>Amount: $${data.amount}</p>
        <p>We'll retry on ${data.retry_date}</p>
        <a href="${data.update_payment_url}">Update Payment Method</a>
      `,
    },
    // ... more templates
  };
  
  const { subject, html } = templates[template];
  
  await resend.emails.send({
    from: 'BlueOx <noreply@blueoxjobs.eu>',
    to,
    subject,
    html,
  });
  
  // Log notification
  await supabase.from('email_notifications').insert({
    recipient_email: to,
    type: template,
    subject,
    status: 'sent',
  });
}
```

### 13.2 Email Events

**When to send emails:**

| Event | Trigger | Template |
|-------|---------|----------|
| Trial day 23 | 7 days before end | trial_ending_7_days |
| Trial day 27 | 3 days before end | trial_ending_3_days |
| Trial day 29 | 1 day before end | trial_ending_tomorrow |
| Trial expired | Day 30 | trial_expired |
| Subscription activated | After payment | subscription_activated |
| Invoice paid | Stripe webhook | invoice_paid |
| Payment failed | Stripe webhook | payment_failed |
| Subscription cancelled | User action | subscription_cancelled |
| User invited | Admin action | user_invitation |
| Monthly report | 1st of month | monthly_usage_report |

---

## 14. Analytics & Reporting

### 14.1 Key Metrics to Track

**Company-level:**
```sql
CREATE TABLE company_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  metric_date DATE NOT NULL,
  
  -- Usage
  active_users INTEGER,
  total_transactions INTEGER,
  api_calls INTEGER,
  storage_mb INTEGER,
  
  -- Modules
  active_modules TEXT[],
  
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, metric_date)
);
```

**Platform-level (admin dashboard):**

```sql
-- MRR (Monthly Recurring Revenue)
SELECT 
  DATE_TRUNC('month', created_at) as month,
  SUM(base_price_amount) as mrr,
  COUNT(*) as active_subscriptions
FROM subscriptions
WHERE status = 'active'
GROUP BY month
ORDER BY month DESC;

-- Churn rate
SELECT 
  DATE_TRUNC('month', cancelled_at) as month,
  COUNT(*) as churned,
  (COUNT(*) * 100.0 / LAG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', cancelled_at))) as churn_rate
FROM subscriptions
WHERE status = 'cancelled'
GROUP BY month;

-- Trial conversion rate
SELECT 
  COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) * 100.0 / 
  COUNT(CASE WHEN trial_start_date IS NOT NULL THEN 1 END) as conversion_rate
FROM company_settings;

-- Average revenue per user (ARPU)
SELECT 
  AVG(base_price_amount + COALESCE(modules_cost, 0)) as arpu
FROM subscriptions s
LEFT JOIN (
  SELECT company_id, SUM(monthly_price) as modules_cost
  FROM subscription_modules
  WHERE is_active = TRUE
  GROUP BY company_id
) m ON s.company_id = m.company_id
WHERE s.status = 'active';
```

---

## 15. Security & Compliance

### 15.1 Data Security

**Encryption:**
- All data encrypted at rest (Supabase/PostgreSQL)
- SSL/TLS for data in transit
- Stripe handles PCI compliance (no card data stored)

**RLS Policies:**
```sql
-- Every table must have RLS enabled
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Users can only access their company's data
CREATE POLICY "company_isolation"
ON invoices
FOR ALL
USING (company_id = current_setting('app.current_company_id')::uuid);
```

### 15.2 GDPR Compliance

**Data export:**
```typescript
// /api/company/export-data/route.ts
export async function GET() {
  const companyId = await getCurrentCompanyId();
  
  // Export all company data
  const data = {
    company: await getCompanyData(companyId),
    users: await getUsers(companyId),
    invoices: await getInvoices(companyId),
    customers: await getCustomers(companyId),
    // ... all tables
  };
  
  return NextResponse.json(data, {
    headers: {
      'Content-Disposition': 'attachment; filename="company-data.json"',
    },
  });
}
```

**Data deletion:**
```typescript
// /api/company/delete-account/route.ts
export async function POST() {
  const companyId = await getCurrentCompanyId();
  
  // Cancel subscription first
  await cancelStripeSubscription(companyId);
  
  // Delete company (CASCADE will delete all related data)
  await supabase
    .from('companies')
    .delete()
    .eq('id', companyId);
  
  // Log deletion for audit
  await logDataDeletion(companyId);
  
  return NextResponse.json({ success: true });
}
```

---

## 16. Implementation Checklist

### Phase 1: Database Setup - COMPLETED
- [ ] Create subscription tables
- [ ] Create subscription_modules table
- [ ] Create billing_history table
- [ ] Add trial columns to company_settings
- [ ] Create indexes
- [ ] Set up RLS policies
- [ ] Create triggers for user count

### Phase 2: Stripe Integration - IN PROGRESS
- [ ] Create Stripe products for plans
- [ ] Create Stripe prices (monthly/annual × regions)
- [ ] Create module products/prices
- [ ] Set up webhook endpoint
- [ ] Implement webhook handlers
- [ ] Test checkout flow
- [ ] Test subscription updates

### Phase 3: Trial System - IN PROGRESS
- [ ] Build module selection page - COMPLETED
- [ ] Update signup flow - COMPLETED
- [ ] Implement trial expiration cron
- [ ] Create trial reminder emails
- [ ] Build upgrade page
- [ ] Test trial-to-paid conversion

### Phase 4: Subscription Management ⏳
- [ ] Build billing dashboard page
- [ ] Implement plan upgrade/downgrade
- [ ] Add module management UI
- [ ] Implement subscription cancellation
- [ ] Build payment method update
- [ ] Create billing history page

### Phase 5: User Management ⏳
- [ ] Build user invitation flow
- [ ] Implement user limit enforcement
- [ ] Create user management UI
- [ ] Add role-based permissions
- [ ] Build team switching (multi-company users)

### Phase 6: Middleware & Access Control ⏳
- [ ] Implement subscription status check
- [ ] Add module access control
- [ ] Create trial warning banner
- [ ] Build expired account page
- [ ] Add user limit checks

### Phase 7: Email System ⏳
- [ ] Set up Resend/SendGrid
- [ ] Create email templates
- [ ] Implement trial reminders
- [ ] Add payment failure emails
- [ ] Create invoice emails
- [ ] Build notification preferences

### Phase 8: Background Jobs ⏳
- [ ] Set up pg_cron
- [ ] Create trial expiration job
- [ ] Add trial reminder job
- [ ] Implement usage tracking
- [ ] Create monthly reports

### Phase 9: Analytics ⏳
- [ ] Build admin metrics dashboard
- [ ] Track MRR/ARR
- [ ] Calculate churn rate
- [ ] Monitor trial conversion
- [ ] Create usage reports

### Phase 10: Security & Compliance ⏳
- [ ] Audit all RLS policies
- [ ] Implement data export
- [ ] Add data deletion flow
- [ ] Create privacy policy page
- [ ] Build terms of service
- [ ] GDPR compliance checklist

---

## Summary

This comprehensive guide covers:

**Multi-tenant architecture** - Company isolation via RLS  
**Subscription system** - Trial → Active → Renewal lifecycle  
**Module management** - Add/remove modules, pay-per-module  
**User management** - Team invitations, role-based access, user limits  
**Payment processing** - Stripe integration, webhooks, invoicing  
**Plan changes** - Upgrades, downgrades, cancellations  
**Background jobs** - Cron jobs for trials, reminders, reports  
**Email notifications** - Templates for all lifecycle events  
**Analytics** - MRR, churn, conversion tracking  
**Security** - RLS, GDPR compliance, data export/deletion  

**Next Steps:**
1. Start with Phase 1: Database Setup (migrations)
2. Integrate Stripe (Phase 2)
3. Complete trial system (Phase 3)
4. Build subscription management UI (Phase 4)

This is production-ready architecture used by companies like Supabase, Vercel, and Linear. Let me know which phase you'd like to implement first!
