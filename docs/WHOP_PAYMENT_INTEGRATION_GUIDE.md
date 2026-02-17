# Whop Payment Integration Guide

> Complete guide for integrating Whop payments with regional pricing in BlueOx Business Platform

## Table of Contents
1. [Overview](#overview)
2. [Regional Pricing Strategy](#regional-pricing-strategy)
3. [Product Architecture](#product-architecture)
4. [VPN & Fraud Prevention](#vpn--fraud-prevention)
5. [Implementation Plan](#implementation-plan)
6. [API Integration](#api-integration)
7. [Webhook Handling](#webhook-handling)
8. [Testing Strategy](#testing-strategy)

---

## Overview

### Current State
- **Payment Provider**: Stripe (to be replaced)
- **Pricing Model**: Regional pricing across 6 regions (AFRICA, ASIA, EU, GB, US, DEFAULT)
- **Products**: 3 plan tiers + 6 modules
- **Challenge**: Significant price variance across regions creates VPN arbitrage risk

### Whop Key Concepts
- **Plans**: Define price and billing type (one_time or renewal)
- **Access Passes**: Products that customers purchase
- **Checkout Configurations**: Attach metadata and custom settings to checkouts
- **Embedded Checkout**: React component for in-app checkout experience

### Why Whop?
- Built for digital products and subscriptions
- Webhook-based fulfillment
- Embedded checkout component
- No PCI compliance burden

---

## Regional Pricing Strategy

### Current Pricing Matrix

#### Base Plan Prices (Monthly)

| Region | Currency | Starter | Professional | Enterprise |
|--------|----------|---------|--------------|------------|
| AFRICA | UGX | 70,000 | 250,000 | 600,000 |
| ASIA | USD | $19 | $69 | $149 |
| EU | EUR | €35 | €129 | €279 |
| GB | GBP | £32 | £119 | £259 |
| US | USD | $39 | $139 | $299 |
| DEFAULT | USD | $29 | $119 | $249 |

#### Module Prices (Monthly)

| Module | AFRICA (UGX) | ASIA ($) | EU (€) | GB (£) | US ($) | DEFAULT ($) |
|--------|--------------|----------|--------|--------|--------|-------------|
| Tours | 75,000 | $19 | €39 | £35 | $39 | $39 |
| Fleet | 65,000 | $17 | €35 | £31 | $35 | $35 |
| Hotels | 85,000 | $22 | €45 | £40 | $45 | $45 |
| Cafe | 65,000 | $17 | €35 | £31 | $35 | $35 |
| Inventory | 75,000 | $19 | €39 | £35 | $39 | $39 |
| Payroll | 95,000 | $25 | €49 | £45 | $49 | $49 |

### Price Variance Analysis

**Arbitrage Risk Examples:**
- Starter Plan: UGX 70,000 ≈ **$19 USD** (Africa) vs **$39 USD** (US) = **2.05x差价**
- Tours Module: UGX 75,000 ≈ **$20 USD** (Africa) vs **$39 USD** (US) = **1.95x差价**

**Risk Level**: MODERATE - 2x price difference incentivizes VPN usage

---

## Product Architecture

### Option 1: Pre-create All Regional Products (RECOMMENDED)

**Structure:**
```
Access Pass: "Starter Plan"
├── Plan: Starter-AFRICA-Monthly (UGX 70,000)
├── Plan: Starter-AFRICA-Annual (UGX 60,000)
├── Plan: Starter-ASIA-Monthly ($19)
├── Plan: Starter-ASIA-Annual ($17)
├── Plan: Starter-EU-Monthly (€35)
└── ... (36 total plan products)

Access Pass: "Tours Module"
├── Plan: Tours-AFRICA (UGX 75,000)
├── Plan: Tours-ASIA ($19)
├── Plan: Tours-EU (€39)
└── ... (36 total module products)
```

**Total Products**: 72 (36 plans + 36 modules)

**Advantages:**
✅ Clean separation of regional pricing
✅ Easy to update individual region prices
✅ Clear analytics per region
✅ Can disable specific regions

**Disadvantages:**
❌ Manual product creation (or script needed)
❌ More products to manage
❌ Price updates require multiple changes

### Option 2: Consolidated Regional Tiers (ALTERNATIVE)

**Simplify to 2-3 price tiers:**
- **Tier 1**: Africa/Asia (UGX pricing or low USD)
- **Tier 2**: Developed Markets (USD/EUR/GBP unified)

**Total Products**: 24 (reduced from 72)

**Advantages:**
✅ Easier to manage
✅ Smaller price gap = less VPN abuse
✅ Fewer webhook variations

**Disadvantages:**
❌ Less pricing flexibility per region
❌ May not optimize for each market

### Option 3: Single Currency with Conversion (NOT RECOMMENDED)

**Why it won't work:**
- Whop/payment processor conversion doesn't respect our intentional pricing differences
- UGX 70,000 converted to USD wouldn't match our Africa pricing strategy
- Loses regional purchasing power optimization

---

## VPN & Fraud Prevention

### The Problem

**Scenario:**
1. User in US detects region via IP/timezone
2. Sees $39/month pricing
3. Uses VPN to appear in Uganda
4. Gets UGX 70,000 ≈ $19 pricing
5. Pays with US credit card
6. **Result**: 50% discount through geography spoofing

### Detection Strategy

#### 1. **Initial Detection (UX Convenience)**
```typescript
// Show prices based on browser timezone (best guess)
const displayRegion = detectRegion(); // From timezone
const pricing = regionalPricing[displayRegion];
```

#### 2. **Checkout Validation (Enforce Truth)**
```typescript
// Whop collects billing address - use this as source of truth
const checkoutConfig = await whop.checkoutConfigurations.create({
  company_id: process.env.WHOP_COMPANY_ID,
  plan: {
    // Direct user to CORRECT regional plan based on billing country
    plan_id: getPlanIdForBillingCountry(billingCountry),
  },
  metadata: {
    expected_region: displayRegion,
    expected_currency: pricing.currency,
    company_id: userCompanyId,
  },
});
```

#### 3. **Webhook Verification (Final Check)**
```typescript
async function handlePaymentSucceeded(payment: Payment) {
  // Extract billing country from payment
  const billingCountry = payment.billing_details?.address?.country;
  const actualRegion = mapCountryToRegion(billingCountry);
  const expectedRegion = payment.metadata.expected_region;
  
  if (actualRegion !== expectedRegion) {
    console.warn(`🚨 Region mismatch: Expected ${expectedRegion}, got ${actualRegion}`);
    
    // ENFORCEMENT OPTIONS:
    
    // Option A: Strict Rejection
    await whop.payments.refund(payment.id);
    await supabase.from('fraud_attempts').insert({
      payment_id: payment.id,
      expected_region: expectedRegion,
      actual_region: actualRegion,
      status: 'refunded',
    });
    return; // Don't activate subscription
    
    // Option B: Auto-upgrade to Correct Price
    const correctPrice = getRegionalPrice(actualRegion, planTier);
    if (payment.amount < correctPrice) {
      // Charge difference
      await chargeAdditionalAmount(payment.customer_id, correctPrice - payment.amount);
    }
    
    // Option C: Manual Review Queue
    await supabase.from('fraud_review_queue').insert({
      payment_id: payment.id,
      expected_region: expectedRegion,
      actual_region: actualRegion,
      status: 'pending_review',
    });
    // Still activate, but flag for review
  }
  
  // Proceed with normal activation
  await activateSubscription(payment);
}
```

### Country to Region Mapping
```typescript
export function mapCountryToRegion(countryCode: string): Region {
  const africanCountries = ['UG', 'KE', 'TZ', 'RW', 'NG', 'GH', 'ZA', 'ET', 'ZM', 'ZW', 'MZ'];
  const asianCountries = ['IN', 'PH', 'TH', 'VN', 'ID', 'BD', 'PK', 'LK', 'MM', 'KH'];
  const euCountries = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL'];
  
  if (africanCountries.includes(countryCode)) return 'AFRICA';
  if (asianCountries.includes(countryCode)) return 'ASIA';
  if (countryCode === 'GB') return 'GB';
  if (euCountries.includes(countryCode)) return 'EU';
  if (countryCode === 'US' || countryCode === 'CA') return 'US';
  
  return 'DEFAULT';
}
```

### Recommended Enforcement Policy

**For 2x price difference (current state):**
- **Primary**: Auto-upgrade to billing country price
- **Secondary**: Flag for review if amount difference > $50
- **Logging**: Track all mismatches for pattern analysis

**If price gap increases to 3x+:**
- **Strict rejection** with refund
- Require manual approval for cross-region purchases

---

## Implementation Plan

### Phase 1: Setup Whop SDK

1. **Install Whop SDK**
```bash
npm install @whop/sdk @whop/checkout
```

2. **Create Whop client wrapper** (`src/lib/whop.ts`)
```typescript
import Whop from "@whop/sdk";

let whopClient: Whop | null = null;

export async function getWhop(): Promise<Whop> {
  if (whopClient) return whopClient;
  
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) throw new Error('WHOP_API_KEY is not configured');
  
  whopClient = new Whop({ apiKey });
  return whopClient;
}

export interface CreateCheckoutParams {
  companyId: string;
  planTier: 'starter' | 'professional' | 'enterprise';
  billingPeriod: 'monthly' | 'annual';
  moduleIds: string[];
  region: Region;
  currency: Currency;
  metadata?: Record<string, string>;
}
```

3. **Environment variables** (`.env.local`)
```env
WHOP_API_KEY=your_company_api_key_here
WHOP_COMPANY_ID=biz_xxxxxxxxxxxxx
WHOP_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
NEXT_PUBLIC_WHOP_PUBLISHABLE_KEY=pk_xxxxxxxxxxxxx
```

### Phase 2: Create Products via Script

**Create setup script** (`scripts/setup-whop-products.ts`)
```typescript
import Whop from "@whop/sdk";
import { regionalPricing, MODULE_PRICING } from "@/lib/regional-pricing";

const whop = new Whop({ apiKey: process.env.WHOP_API_KEY! });
const COMPANY_ID = process.env.WHOP_COMPANY_ID!;

async function setupWhopProducts() {
  console.log('🚀 Creating Whop products...');
  
  // 1. Create Access Passes (one per product type)
  const starterPass = await whop.accessPasses.create({
    company_id: COMPANY_ID,
    name: "Starter Plan",
    description: "Core accounting features for small businesses",
  });
  
  const professionalPass = await whop.accessPasses.create({
    company_id: COMPANY_ID,
    name: "Professional Plan",
    description: "Advanced features for growing businesses",
  });
  
  // ... Create all access passes
  
  // 2. Create Plans for each region
  const regions = ['AFRICA', 'ASIA', 'EU', 'GB', 'US', 'DEFAULT'] as const;
  
  for (const region of regions) {
    const pricing = regionalPricing[region];
    
    // Starter Monthly
    await whop.plans.create({
      company_id: COMPANY_ID,
      access_pass_id: starterPass.id,
      internal_name: `Starter-${region}-Monthly`,
      initial_price: pricing.starter.monthly,
      plan_type: "renewal",
      renewal_period: "monthly",
      visibility: "visible",
    });
    
    // Starter Annual
    await whop.plans.create({
      company_id: COMPANY_ID,
      access_pass_id: starterPass.id,
      internal_name: `Starter-${region}-Annual`,
      initial_price: pricing.starter.annually,
      plan_type: "renewal",
      renewal_period: "yearly",
      visibility: "visible",
    });
    
    // ... Repeat for Professional and Enterprise
  }
  
  // 3. Create Module Plans
  const modules = ['tours', 'fleet', 'hotels', 'cafe', 'inventory', 'payroll'];
  
  for (const moduleId of modules) {
    const modulePass = await whop.accessPasses.create({
      company_id: COMPANY_ID,
      name: `${moduleId} Module`,
      description: `Add-on module: ${moduleId}`,
    });
    
    for (const region of regions) {
      const pricing = MODULE_PRICING[region];
      
      await whop.plans.create({
        company_id: COMPANY_ID,
        access_pass_id: modulePass.id,
        internal_name: `${moduleId}-${region}`,
        initial_price: pricing[moduleId],
        plan_type: "renewal",
        renewal_period: "monthly",
        visibility: "visible",
      });
    }
  }
  
  console.log('✅ Products created successfully!');
}

setupWhopProducts().catch(console.error);
```

**Run once:**
```bash
npx tsx scripts/setup-whop-products.ts
```

### Phase 3: Create Checkout Configuration Helper

**Add to `src/lib/whop-config.ts`**
```typescript
import { Region, Currency } from './regional-pricing';

// Map internal IDs to Whop plan IDs (populated after running setup script)
export const WHOP_PLAN_IDS: Record<string, Record<Region, string>> = {
  'starter-monthly': {
    AFRICA: 'plan_xxxxxxxxxxxxx',
    ASIA: 'plan_xxxxxxxxxxxxx',
    EU: 'plan_xxxxxxxxxxxxx',
    GB: 'plan_xxxxxxxxxxxxx',
    US: 'plan_xxxxxxxxxxxxx',
    DEFAULT: 'plan_xxxxxxxxxxxxx',
  },
  'starter-annual': { /* ... */ },
  'professional-monthly': { /* ... */ },
  'professional-annual': { /* ... */ },
  'enterprise-monthly': { /* ... */ },
  'enterprise-annual': { /* ... */ },
};

export const WHOP_MODULE_IDS: Record<string, Record<Region, string>> = {
  tours: {
    AFRICA: 'plan_xxxxxxxxxxxxx',
    ASIA: 'plan_xxxxxxxxxxxxx',
    // ...
  },
  // ... other modules
};

export function getPlanId(
  planTier: string,
  billingPeriod: string,
  region: Region
): string {
  const key = `${planTier}-${billingPeriod}`;
  const planId = WHOP_PLAN_IDS[key]?.[region];
  
  if (!planId) {
    throw new Error(`No Whop plan ID found for ${key} in ${region}`);
  }
  
  return planId;
}

export function getModulePlanId(moduleId: string, region: Region): string {
  const planId = WHOP_MODULE_IDS[moduleId]?.[region];
  
  if (!planId) {
    throw new Error(`No Whop plan ID found for module ${moduleId} in ${region}`);
  }
  
  return planId;
}
```

### Phase 4: Update Checkout API

**Replace `src/app/api/billing/create-checkout/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getWhop } from '@/lib/whop';
import { getPlanId, getModulePlanId } from '@/lib/whop-config';
import { createClient } from '@/lib/supabase/server';
import { detectRegion } from '@/lib/regional-pricing';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { plan_tier, billing_period, module_ids = [] } = body;
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user's company
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();
    
    if (!profile?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 });
    }
    
    // Detect region (display region - may differ from billing)
    const displayRegion = detectRegion();
    
    // Get base plan ID
    const basePlanId = getPlanId(plan_tier, billing_period, displayRegion);
    
    // Get module plan IDs
    const modulePlanIds = module_ids.map((moduleId: string) => 
      getModulePlanId(moduleId, displayRegion)
    );
    
    // Create checkout configuration
    const whop = await getWhop();
    const checkoutConfig = await whop.checkoutConfigurations.create({
      company_id: process.env.WHOP_COMPANY_ID!,
      plan_ids: [basePlanId, ...modulePlanIds],
      metadata: {
        company_id: profile.company_id,
        user_id: user.id,
        plan_tier,
        billing_period,
        module_ids: JSON.stringify(module_ids),
        display_region: displayRegion,
        // Billing region will be validated in webhook
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing/upgrade`,
    });
    
    return NextResponse.json({
      sessionId: checkoutConfig.id,
      url: checkoutConfig.checkout_url,
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
```

### Phase 5: Frontend Checkout Component

**Option A: Redirect to Whop Checkout (Simplest)**
```typescript
// src/app/dashboard/billing/upgrade/page.tsx
const handleUpgrade = async () => {
  const response = await fetch('/api/billing/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_tier: selectedPlan,
      billing_period: billingPeriod,
      module_ids: selectedModules,
    }),
  });
  
  const { url } = await response.json();
  window.location.href = url; // Redirect to Whop-hosted checkout
};
```

**Option B: Embedded Checkout (Better UX)**
```typescript
'use client';

import { WhopCheckoutEmbed } from "@whop/checkout/react";
import { useState, useEffect } from 'react';

export default function UpgradePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  useEffect(() => {
    // Create checkout session on mount
    fetch('/api/billing/create-checkout', {
      method: 'POST',
      body: JSON.stringify({
        plan_tier: 'professional',
        billing_period: 'monthly',
        module_ids: ['tours'],
      }),
    })
      .then(res => res.json())
      .then(data => setSessionId(data.sessionId));
  }, []);
  
  if (!sessionId) return <div>Loading checkout...</div>;
  
  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Complete Your Purchase</h1>
      
      <WhopCheckoutEmbed
        sessionId={sessionId}
        returnUrl={`${window.location.origin}/dashboard/billing/success`}
        onComplete={(paymentId) => {
          console.log('Payment complete:', paymentId);
          window.location.href = '/dashboard/billing/success';
        }}
      />
    </div>
  );
}
```

---

## Webhook Handling

### Setup Webhook Endpoint

**Create `src/app/api/webhooks/whop/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import type { Payment } from '@whop/sdk/resources.js';
import { getWhop } from '@/lib/whop';
import { createClient } from '@supabase/supabase-js';
import { mapCountryToRegion } from '@/lib/regional-pricing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const requestBodyText = await request.text();
    const headers = Object.fromEntries(request.headers);
    
    // Verify webhook signature
    const whop = await getWhop();
    const webhookData = whop.webhooks.unwrap(requestBodyText, { headers });
    
    console.log(`📨 Whop webhook: ${webhookData.type}`);
    
    switch (webhookData.type) {
      case 'payment.succeeded':
        await handlePaymentSucceeded(webhookData.data);
        break;
        
      case 'payment.failed':
        await handlePaymentFailed(webhookData.data);
        break;
        
      case 'membership.activated':
        await handleMembershipActivated(webhookData.data);
        break;
        
      case 'membership.cancelled':
        await handleMembershipCancelled(webhookData.data);
        break;
        
      default:
        console.log(`ℹ️  Unhandled webhook: ${webhookData.type}`);
    }
    
    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return new Response('Webhook handler failed', { status: 500 });
  }
}

async function handlePaymentSucceeded(payment: Payment) {
  console.log('✅ Processing payment.succeeded');
  
  const metadata = payment.metadata;
  const companyId = metadata.company_id;
  const planTier = metadata.plan_tier;
  const billingPeriod = metadata.billing_period;
  const moduleIds = JSON.parse(metadata.module_ids || '[]');
  const displayRegion = metadata.display_region;
  
  // VPN/Fraud Detection
  const billingCountry = payment.billing_details?.address?.country;
  const actualRegion = billingCountry ? mapCountryToRegion(billingCountry) : 'DEFAULT';
  
  if (actualRegion !== displayRegion) {
    console.warn(`🚨 Region mismatch detected!`);
    console.warn(`Expected: ${displayRegion}, Actual: ${actualRegion}`);
    
    // Log fraud attempt
    await supabase.from('fraud_attempts').insert({
      payment_id: payment.id,
      company_id: companyId,
      expected_region: displayRegion,
      actual_region: actualRegion,
      amount: payment.amount,
      billing_country: billingCountry,
      created_at: new Date().toISOString(),
    });
    
    // ENFORCEMENT: Auto-upgrade (charge difference if needed)
    // For now, we'll allow but flag for review
  }
  
  // Create subscription record
  const { error: subError } = await supabase.from('subscriptions').insert({
    company_id: companyId,
    plan_tier: planTier,
    billing_period: billingPeriod,
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + (billingPeriod === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString(),
    base_price_amount: payment.amount / 100,
    currency: payment.currency,
    whop_payment_id: payment.id,
    whop_membership_id: payment.membership_id,
    actual_billing_region: actualRegion,
  });
  
  if (subError) {
    console.error('Failed to create subscription:', subError);
    return;
  }
  
  // Deactivate trial modules
  await supabase
    .from('subscription_modules')
    .update({ is_active: false })
    .eq('company_id', companyId)
    .eq('is_trial_module', true);
  
  // Activate paid modules
  for (const moduleId of moduleIds) {
    await supabase.from('subscription_modules').insert({
      company_id: companyId,
      module_id: moduleId,
      is_active: true,
      monthly_price: 0, // TODO: Get from MODULE_PRICING
      currency: payment.currency,
      is_trial_module: false,
    });
  }
  
  // Update company settings
  await supabase
    .from('company_settings')
    .update({
      subscription_status: 'active',
      plan_tier: planTier,
    })
    .eq('company_id', companyId);
  
  // Log in billing history
  await supabase.from('billing_history').insert({
    company_id: companyId,
    invoice_number: payment.id,
    amount: payment.amount / 100,
    currency: payment.currency,
    status: 'succeeded',
    paid_at: new Date().toISOString(),
    billing_region: actualRegion,
  });
  
  console.log(`✅ Subscription activated for company ${companyId}`);
}

async function handlePaymentFailed(payment: Payment) {
  console.log('❌ Processing payment.failed');
  
  const companyId = payment.metadata.company_id;
  
  // Update subscription status
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('company_id', companyId);
  
  // Log failed payment
  await supabase.from('billing_history').insert({
    company_id: companyId,
    invoice_number: payment.id,
    amount: payment.amount / 100,
    currency: payment.currency,
    status: 'failed',
    paid_at: new Date().toISOString(),
  });
}

async function handleMembershipActivated(membership: any) {
  console.log('✅ Processing membership.activated');
  // Handle membership activation if needed
}

async function handleMembershipCancelled(membership: any) {
  console.log('❌ Processing membership.cancelled');
  
  const companyId = membership.metadata?.company_id;
  
  if (companyId) {
    // Deactivate subscription
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('company_id', companyId);
    
    // Deactivate all paid modules
    await supabase
      .from('subscription_modules')
      .update({ is_active: false })
      .eq('company_id', companyId)
      .eq('is_trial_module', false);
    
    console.log(`✅ Subscription cancelled for company ${companyId}`);
  }
}
```

### Configure Webhook in Whop Dashboard

1. Go to Whop Dashboard > Developer > Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/whop`
3. Select events:
   - `payment.succeeded`
   - `payment.failed`
   - `membership.activated`
   - `membership.cancelled`
4. Copy webhook secret to `.env`:
   ```
   WHOP_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

---

## Testing Strategy

### 1. Local Testing with Whop Webhook CLI

```bash
# Install Whop CLI
npm install -g @whop/cli

# Login
whop login

# Forward webhooks to local dev
whop webhooks forward --url http://localhost:3000/api/webhooks/whop
```

### 2. Test Payment Flow

```typescript
// Test different regions
const testRegions = ['AFRICA', 'ASIA', 'EU', 'GB', 'US'];

for (const region of testRegions) {
  // 1. Create checkout for region
  const response = await fetch('/api/billing/create-checkout', {
    method: 'POST',
    body: JSON.stringify({
      plan_tier: 'starter',
      billing_period: 'monthly',
      module_ids: ['tours'],
      test_region: region, // For testing
    }),
  });
  
  // 2. Complete payment with test card
  // 3. Verify webhook received
  // 4. Verify subscription created
  // 5. Verify modules activated
}
```

### 3. VPN Testing

**Simulate region mismatch:**
```typescript
// User appears in AFRICA (VPN)
// Billing address in US
// Expected behavior: Flag and log, but allow (or reject based on policy)

await testPayment({
  displayRegion: 'AFRICA',
  billingCountry: 'US',
  expectedOutcome: 'fraud_logged',
});
```

### 4. Edge Cases

- [ ] User cancels during checkout
- [ ] Payment fails (declined card)
- [ ] User changes region mid-session
- [ ] Multiple simultaneous purchases
- [ ] Add module to existing subscription
- [ ] Upgrade plan tier
- [ ] Downgrade plan tier
- [ ] Cancel subscription
- [ ] Reactivate cancelled subscription

---

## Migration from Stripe

### Step-by-Step Migration

1. **Run Whop setup in parallel** (don't remove Stripe yet)
   ```bash
   npm install @whop/sdk @whop/checkout
   npx tsx scripts/setup-whop-products.ts
   ```

2. **Feature flag for payment provider**
   ```typescript
   // .env
   PAYMENT_PROVIDER=stripe # or 'whop'
   
   // In checkout API
   if (process.env.PAYMENT_PROVIDER === 'whop') {
     return createWhopCheckout();
   } else {
     return createStripeCheckout();
   }
   ```

3. **Test Whop integration fully** with test mode

4. **Migrate existing Stripe customers**
   - Option A: Keep existing on Stripe, new customers on Whop
   - Option B: Cancel Stripe subs, recreate on Whop (requires customer action)
   - Option C: Dual-provider support (complexity++)

5. **Switch production traffic** to Whop

6. **Phase out Stripe** after all customers migrated

---

## Security Checklist

- [ ] **Webhook signature verification** enabled
- [ ] **WHOP_API_KEY** stored in server environment only (not exposed to client)
- [ ] **Billing country validation** implemented
- [ ] **Fraud attempt logging** in database
- [ ] **Rate limiting** on checkout API
- [ ] **HTTPS only** for webhook endpoint
- [ ] **Metadata sanitization** (prevent injection)
- [ ] **Test mode** clearly indicated in UI
- [ ] **Webhook replay protection** (check event IDs)
- [ ] **Error handling** doesn't expose sensitive data

---

## Monitoring & Analytics

### Key Metrics to Track

```typescript
// Dashboard queries
SELECT 
  actual_billing_region,
  COUNT(*) as subscription_count,
  SUM(base_price_amount) as total_revenue,
  AVG(base_price_amount) as avg_price
FROM subscriptions
WHERE status = 'active'
GROUP BY actual_billing_region;

// Fraud detection
SELECT 
  expected_region,
  actual_region,
  COUNT(*) as mismatch_count,
  SUM(amount) as potential_loss
FROM fraud_attempts
GROUP BY expected_region, actual_region
ORDER BY mismatch_count DESC;
```

### Alerts to Set Up

- Payment failure rate > 5%
- Region mismatch rate > 2%
- Webhook delivery failure
- Subscription churn spike
- Revenue per region dropping

---

## Additional Resources

- [Whop Documentation](https://docs.whop.com)
- [Whop API Reference](https://docs.whop.com/api-reference)
- [Whop SDK (TypeScript)](https://www.npmjs.com/package/@whop/sdk)
- [Whop Checkout React](https://www.npmjs.com/package/@whop/checkout)

---

## FAQ

### Q: Can I update prices without recreating products?
**A:** Yes, use the Whop API to update plan prices:
```typescript
await whop.plans.update(planId, {
  initial_price: newPrice,
});
```

### Q: How do I handle currency conversion?
**A:** Whop handles payment processing in the plan's currency. Your regional pricing is already in the correct currency per region.

### Q: What if a customer moves regions?
**A:** On next renewal, detect new region and redirect to appropriate regional plan. Legacy subscriptions continue at original price.

### Q: Can I offer discounts/coupons?
**A:** Yes, Whop supports promotion codes. Configure in dashboard or via API.

### Q: How do I handle refunds?
**A:** Use `whop.payments.refund(paymentId)` and update subscription status in your database.

### Q: What about taxes (VAT, sales tax)?
**A:** Whop can handle tax collection based on billing country. Configure tax settings in Whop dashboard.

---

## Next Steps

1. [ ] Review this guide with team
2. [ ] Set up Whop company account
3. [ ] Run `setup-whop-products.ts` script in test mode
4. [ ] Implement checkout API endpoint
5. [ ] Add webhook handler
6. [ ] Test payment flow end-to-end
7. [ ] Implement fraud detection
8. [ ] Set up monitoring
9. [ ] Plan Stripe migration
10. [ ] Launch in production

**Estimated Implementation Time**: 3-5 days for core integration + 2-3 days for fraud prevention + 1 week testing
