# Future Add-On Services (Premium Support)

**Status:** Planned (Not Yet Implemented)  
**Purpose:** Optional premium services for customers who need extra help

---

## Overview

These are **optional add-on services** that customers can purchase separately from their subscription. They are NOT mandatory setup fees, but value-added services for customers who want hands-on assistance.

---

## Proposed Services

### 1. White Glove Onboarding - $499 (One-time)

**What's Included:**
- Dedicated onboarding specialist
- 1-on-1 video call (up to 2 hours)
- Custom account setup based on business needs
- Chart of accounts configuration
- Initial data entry assistance
- Team member invitation and setup
- Feature walkthrough and best practices
- Follow-up email support for 30 days

**Target Customers:**
- Enterprise clients
- Businesses switching from another system
- Non-technical users
- Teams that need training

**Delivery Timeline:** 3-5 business days from purchase

---

### 2. Data Migration Service - $799 (One-time)

**What's Included:**
- Import data from CSV/Excel files
- Migration from QuickBooks/Xero/other accounting software
- Up to 5 data types:
  - Chart of Accounts
  - Customers
  - Vendors
  - Products/Services
  - Historical transactions (1 year)
- Data validation and cleanup
- Test migration + final migration
- Post-migration verification

**Target Customers:**
- Businesses switching from spreadsheets
- Companies migrating from other accounting software
- Businesses with large historical data

**Delivery Timeline:** 5-7 business days (depends on data volume)

**Requirements:**
- Customer provides data in CSV/Excel format
- Or provides read-only access to current system (if supported)

---

### 3. Custom Training Session - $299/session (1 hour)

**What's Included:**
- Live video training session (1 hour)
- Customized to specific modules/features
- Screen sharing and live demo
- Q&A session
- Session recording provided
- Follow-up documentation

**Common Training Topics:**
- Accounting fundamentals in BlueOx
- Tour/Safari module deep dive
- Fleet management best practices
- Hotel booking system training
- Financial reporting and analysis
- Multi-currency operations
- Team collaboration features

**Target Customers:**
- Teams onboarding new employees
- Businesses needing specific feature training
- Seasonal businesses training temporary staff

**Delivery Timeline:** Scheduled within 2 business days

---

## Implementation Plan (Future Phase)

### Database Schema

Add new table: `premium_services`

```sql
CREATE TABLE premium_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  service_type VARCHAR(50) NOT NULL, -- 'onboarding', 'migration', 'training'
  status VARCHAR(20) DEFAULT 'pending', -- pending/scheduled/in_progress/completed/cancelled
  purchase_date TIMESTAMPTZ DEFAULT NOW(),
  scheduled_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  price_paid DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  stripe_payment_intent_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session tracking for training
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premium_service_id UUID REFERENCES premium_services(id),
  session_date TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60,
  topics TEXT[], -- Array of topics covered
  recording_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Stripe Product Setup

```typescript
// Add to Stripe products
const premiumServices = {
  onboarding: {
    name: 'White Glove Onboarding',
    price: 499,
    type: 'one_time',
  },
  migration: {
    name: 'Data Migration Service',
    price: 799,
    type: 'one_time',
  },
  training: {
    name: 'Custom Training Session',
    price: 299,
    type: 'one_time',
  },
};
```

### UI Pages to Build

1. **src/app/dashboard/services/page.tsx**
   - List of available premium services
   - "Purchase" buttons
   - Status of purchased services

2. **src/app/dashboard/services/[type]/page.tsx**
   - Service details page
   - Checkout flow
   - Scheduling interface

3. **API Endpoints:**
   - `POST /api/services/purchase` - Purchase a service
   - `GET /api/services/purchased` - List purchased services
   - `POST /api/services/schedule` - Schedule a session
   - `POST /api/services/complete` - Mark as completed (admin only)

### Marketing Integration

**Landing Page Updates:**
- Add "Premium Services" section
- Show as optional add-ons below pricing
- Testimonials from customers who used services

**In-App Prompts:**
- During signup: "Need help getting started?"
- After trial starts: "Schedule onboarding call"
- When adding modules: "Get trained on new features"

---

## Pricing Justification

### White Glove Onboarding ($499)
- 2 hours specialist time @ $150/hr = $300
- Preparation & follow-up (1 hour) = $150
- Tools & systems overhead = $50
- **Total Value:** $500

### Data Migration ($799)
- Technical work (4-6 hours) @ $100/hr = $400-600
- Data validation & cleanup = $150
- Testing & verification = $50
- Risk premium (data accuracy) = $100
- **Total Value:** $700-900

### Training Session ($299)
- 1 hour live session @ $150/hr = $150
- Preparation (30 mins) = $75
- Recording & documentation = $50
- Platform costs = $25
- **Total Value:** $300

---

## Customer Journey

### Example: Professional Plan Customer

```
Signup Flow:
  Trial signup ($0)
  ↓
  Email Day 1: "Welcome! Need help?"
  → CTA: "Book Free 15-min Setup Call"
  ↓
  Email Day 3: "Getting the most out of your trial"
  → CTA: "Add White Glove Onboarding ($499)"
  ↓
  Trial Day 25: "5 days left in trial"
  → CTA: "Upgrade + Get Training Package"
  ↓
  Upgrades to Paid:
  → Upsell: "Add Migration Service ($799)"
  → Save time importing old data
  ↓
  3 months later: Adding Fleet Module
  → Upsell: "Train your team ($299/session)"
```

---

## Success Metrics to Track

Once implemented, measure:
- Conversion rate: Free trial → Paid + Service
- Average order value increase
- Customer satisfaction (NPS) for service users
- Retention rate (do service customers stay longer?)
- Support ticket reduction (do trained customers need less help?)

**Hypothesis:** Customers who purchase services have:
- 30% higher retention rate
- 40% lower churn in first 6 months
- 50% fewer support tickets

---

## Competitive Analysis

| Service | BlueOx | QuickBooks | Xero | Zoho Books |
|---------|--------|------------|------|------------|
| Onboarding | $499 | $500-1000 | Included (Enterprise) | $400 |
| Migration | $799 | $800-1500 | $600-1200 | $500-1000 |
| Training | $299/hr | $300/hr | $250/hr | $200/hr |

**Our Position:** Competitive pricing with clear deliverables

---

## Revenue Projections

**Conservative Estimates (Year 1):**

Assumptions:
- 100 paid customers
- 20% purchase onboarding
- 10% purchase migration
- 5% purchase training (average 2 sessions/year)

```
Onboarding: 20 × $499 = $9,980
Migration: 10 × $799 = $7,990
Training: 5 × 2 × $299 = $2,990
-----------------------------------------
Total Annual Services Revenue: $20,960
```

**With 500 customers:**
```
Total Annual Services Revenue: $104,800
```

This represents **15-20% additional revenue** on top of subscription MRR.

---

## Next Steps (When Ready to Implement)

1. **Phase 1: Infrastructure**
   - Create database tables
   - Set up Stripe products
   - Build purchase API endpoints

2. **Phase 2: Booking System**
   - Calendar integration (Calendly/Cal.com)
   - Automated scheduling
   - Email confirmations

3. **Phase 3: Delivery Process**
   - Internal dashboard for service team
   - Task tracking & checklists
   - Quality assurance forms

4. **Phase 4: Marketing**
   - Landing page updates
   - Email campaigns
   - In-app upsell prompts

**Estimated Build Time:** 2-3 weeks  
**Team Needed:** 1 developer + 1 designer + service delivery team

---

## Important Notes

⚠️ **Key Differences from Setup Fees:**

| Setup Fee | Premium Service |
|-----------|-----------------|
| Mandatory | Optional |
| Charged to everyone | Only to those who want it |
| No value delivered | Clear deliverables |
| Creates barrier | Creates opportunity |
| Industry anti-pattern | Industry best practice |

✅ **This is the right approach** - give customers choice and charge for real value.

---

## Summary

These premium services:
- Generate additional revenue without barrier to entry
- Improve customer success and retention
- Differentiate from competitors
- Scale with your customer base
- Provide clear value proposition

**Status:** Ready to implement in future phase (Phase 6 or later)
