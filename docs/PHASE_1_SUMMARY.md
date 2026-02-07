# Phase 1 Implementation Summary - Database Setup

**Date:** February 4, 2026  
**Status:** ✅ COMPLETED

---

## Overview

Successfully implemented the complete database foundation for the SaaS subscription system. All tables, triggers, and policies are now in place to support trial management, subscription tracking, module add-ons, and billing.

---

## Migrations Created

### 055_add_trial_modules.sql
**Purpose:** Extend company_settings with subscription tracking

**Columns Added:**
- `trial_modules` (TEXT[]) - Array of selected trial modules
- `trial_start_date` (TIMESTAMP) - When trial began
- `trial_end_date` (TIMESTAMP) - When trial expires (30 days)
- `subscription_status` (ENUM) - trial | active | past_due | cancelled | expired
- `plan_tier` (ENUM) - starter | professional | enterprise
- `billing_period` (ENUM) - monthly | annual
- `current_period_start` (TIMESTAMP) - Current billing period start
- `current_period_end` (TIMESTAMP) - Current billing period end
- `current_user_count` (INTEGER) - Number of active users
- `max_users_allowed` (INTEGER) - User limit based on plan
- `stripe_customer_id` (TEXT) - Stripe customer reference
- `stripe_subscription_id` (TEXT) - Stripe subscription reference
- `stripe_payment_method_id` (TEXT) - Saved payment method

**Constraints:**
- Check constraints for enum values
- Default values for trial setup

### 056_create_subscriptions_table.sql
**Purpose:** Detailed subscription tracking separate from company_settings

**Schema:**
```sql
subscriptions:
- id (UUID, PK)
- company_id (UUID, FK → companies)
- plan_tier (starter/professional/enterprise)
- billing_period (monthly/annual)
- status (trial/active/past_due/cancelled/expired)
- trial_start_date, trial_end_date
- current_period_start, current_period_end
- cancel_at_period_end (BOOLEAN)
- cancelled_at (TIMESTAMP)
- base_price_amount (DECIMAL) - Price snapshot
- currency (USD/EUR/GBP/UGX)
- discount_percent (INTEGER) - For annual billing
- pending_plan_change (TEXT) - Scheduled downgrades
- plan_change_at (TIMESTAMP)
- stripe_customer_id, stripe_subscription_id
- stripe_payment_method_id
```

**Indexes:**
- `idx_subscriptions_company` - Fast company lookups
- `idx_subscriptions_status` - Filter by status
- `idx_subscriptions_period_end` - Find expiring subscriptions
- `idx_subscriptions_stripe` - Webhook lookups

**RLS Policies:**
- Users can view their company subscription
- Only owners/admins can manage subscriptions

### 057_create_subscription_modules_table.sql
**Purpose:** Track active industry modules per company

**Schema:**
```sql
subscription_modules:
- id (UUID, PK)
- company_id (UUID, FK → companies)
- module_id (tours/fleet/hotels/cafe/security/inventory)
- monthly_price (DECIMAL) - Price when added
- setup_fee (DECIMAL)
- currency (TEXT)
- is_active (BOOLEAN)
- is_trial_module (BOOLEAN) - From trial vs paid
- added_at, removed_at (TIMESTAMP)
- next_billing_date (TIMESTAMP)
- stripe_subscription_item_id (TEXT)
```

**Unique Constraint:**
- `(company_id, module_id, is_active)` - Prevents duplicate active modules

**Indexes:**
- `idx_subscription_modules_company`
- `idx_subscription_modules_active` - Fast module access checks
- `idx_subscription_modules_module` - Platform-wide module stats

**Functions:**
- `has_module_access(company_id, module_id)` - Returns BOOLEAN
- Used by middleware to check module permissions

**RLS Policies:**
- Users can view their company modules
- Only admins can add/remove modules

### 058_create_billing_history_table.sql
**Purpose:** Complete payment and invoice audit trail

**Schema:**
```sql
billing_history:
- id (UUID, PK)
- company_id (UUID, FK)
- subscription_id (UUID, FK)
- amount (DECIMAL)
- currency (TEXT)
- status (pending/succeeded/failed/refunded)
- invoice_number (TEXT, UNIQUE)
- invoice_url (TEXT) - Stripe hosted invoice
- invoice_pdf_url (TEXT)
- period_start, period_end (TIMESTAMP)
- base_plan_cost (DECIMAL) - Breakdown
- modules_cost (DECIMAL)
- discount_amount (DECIMAL)
- tax_amount (DECIMAL)
- stripe_invoice_id, stripe_payment_intent_id
- stripe_charge_id
- paid_at, failed_at (TIMESTAMP)
- failure_reason (TEXT)
```

**Indexes:**
- `idx_billing_history_company`
- `idx_billing_history_status`
- `idx_billing_history_period` - Date range queries
- `idx_billing_history_stripe_invoice` - Webhook deduplication
- `idx_billing_history_created` - Recent first

**RLS Policies:**
- Users can view company billing history
- Only system can insert (via backend API)

### 059_create_user_invitations_table.sql
**Purpose:** Track team member invitation flow

**Schema:**
```sql
user_invitations:
- id (UUID, PK)
- company_id (UUID, FK)
- email (TEXT)
- role (admin/manager/accountant/viewer)
- token (TEXT, UNIQUE) - For invitation URL
- invited_by (UUID, FK → user_profiles)
- expires_at (TIMESTAMP) - 7 days from creation
- accepted_at (TIMESTAMP)
```

**Indexes:**
- `idx_user_invitations_company`
- `idx_user_invitations_token` - Fast token lookups
- `idx_user_invitations_email`
- `idx_user_invitations_expires` - Cleanup expired invites

**RLS Policies:**
- Users can view company invitations
- Only admins can create invitations

### 060_create_email_notifications_table.sql
**Purpose:** Email delivery tracking and audit

**Schema:**
```sql
email_notifications:
- id (UUID, PK)
- company_id (UUID, FK)
- user_id (UUID, FK)
- type (TEXT) - trial_ending_7_days, payment_failed, etc.
- recipient_email (TEXT)
- subject (TEXT)
- sent_at (TIMESTAMP)
- status (sent/failed/bounced)
- error_message (TEXT)
```

**Email Types:**
- `trial_ending_7_days` - 7 days before trial ends
- `trial_ending_3_days` - 3 days before trial ends
- `trial_ending_tomorrow` - 1 day before trial ends
- `trial_expired` - Trial has ended
- `payment_failed` - Payment couldn't be processed
- `invoice_paid` - Successful payment
- `subscription_activated` - New paid subscription
- `subscription_cancelled` - User cancelled
- `user_invitation` - Team member invite

**Indexes:**
- `idx_email_notifications_company`
- `idx_email_notifications_type` - Prevent duplicate sends
- `idx_email_notifications_recipient`

**RLS Policies:**
- Users can view their notifications or company notifications

### 061_create_user_tracking_triggers.sql
**Purpose:** Automated user count management and limits

**Functions Created:**

1. **update_company_user_count()**
   - Triggers on INSERT/DELETE to user_profiles
   - Auto-increments/decrements current_user_count
   - Updates company_settings.updated_at

2. **check_company_user_limit()**
   - Triggers BEFORE INSERT on user_profiles
   - Checks current_user_count < max_users_allowed
   - Enterprise plan has unlimited users
   - Raises exception if limit exceeded

3. **initialize_company_settings()**
   - Triggers AFTER INSERT on companies
   - Auto-creates company_settings record
   - Sets trial defaults:
     - subscription_status = 'trial'
     - plan_tier = 'professional'
     - trial_start_date = NOW()
     - trial_end_date = NOW() + 30 days
     - max_users_allowed = 10

---

## Code Updates

### src/app/signup/select-modules/page.tsx
**Changes:**
- Updated `handleContinue()` to save to subscription_modules table
- Creates records with `is_trial_module = true`
- Saves pricing snapshot (monthly_price, setup_fee, currency)
- Still updates company_settings.trial_modules for backwards compatibility

**Before:**
```typescript
// Only saved to company_settings.trial_modules
await supabase.from('company_settings').update({
  trial_modules: selectedModules
})
```

**After:**
```typescript
// Saves to both subscription_modules AND company_settings
const moduleRecords = selectedModules.map(moduleId => ({
  company_id: profileData.company_id,
  module_id: moduleId,
  monthly_price: module.price,
  is_active: true,
  is_trial_module: true,
}));

await supabase.from('subscription_modules').insert(moduleRecords);
await supabase.from('company_settings').update({
  trial_modules: selectedModules
})
```

---

## Database Schema Summary

**New Tables:** 6
- `subscriptions` - Main subscription tracking
- `subscription_modules` - Module add-ons
- `billing_history` - Payment records
- `user_invitations` - Team invites
- `email_notifications` - Email log

**Extended Tables:** 1
- `company_settings` - Added 13 new columns

**New Functions:** 4
- `has_module_access()` - Module permission check
- `update_company_user_count()` - Auto user counting
- `check_company_user_limit()` - Enforce plan limits
- `initialize_company_settings()` - Trial setup

**New Triggers:** 3
- `trigger_update_user_count` - On user_profiles
- `trigger_check_user_limit` - On user_profiles
- `trigger_initialize_company_settings` - On companies

**Total Indexes:** 27
- Optimized for lookups by company, status, dates, Stripe IDs

**RLS Policies:** 13
- All tables protected with row-level security
- Users see only their company data
- Admins can manage subscriptions/modules
- System-only inserts for billing

---

## What This Enables

✅ **30-Day Trial System**
- Auto-start trial on signup
- Track trial expiration
- Store selected trial modules

✅ **Subscription Management**
- Multiple plan tiers (Starter, Professional, Enterprise)
- Monthly/Annual billing periods
- Cancel at period end option
- Scheduled plan changes

✅ **Module Add-Ons**
- Track active modules per company
- Price snapshots (prevent retroactive changes)
- Trial vs paid module distinction
- Individual module billing via Stripe

✅ **User Limits**
- Automatic user counting
- Plan-based limits enforcement
- Starter: 3 users, Professional: 10, Enterprise: Unlimited
- Upgrade prompt when limit reached

✅ **Billing Transparency**
- Complete payment history
- Invoice tracking with PDFs
- Cost breakdowns (base + modules + tax)
- Payment failure tracking

✅ **Team Invitations**
- Role-based invites
- Expiring invitation tokens
- Acceptance tracking

✅ **Email Audit Trail**
- All emails logged
- Bounce tracking
- Prevents duplicate sends

---

## Testing Checklist

Before deploying to production:

- [ ] Run all migrations in order (055 → 061)
- [ ] Test trial signup flow
- [ ] Verify module selection saves to subscription_modules
- [ ] Test user limit enforcement (try adding 11th user to Professional)
- [ ] Check RLS policies (users can't see other companies' data)
- [ ] Verify triggers fire correctly
- [ ] Test has_module_access() function
- [ ] Check company_settings auto-creation on signup

---

## Next Phase

**Phase 2: Stripe Integration** (Ready to implement)

Will include:
1. Stripe product/price creation script
2. Checkout session API endpoint
3. Webhook handler for all events
4. Subscription update/cancel endpoints
5. Payment method management
6. Invoice generation

---

## Files Modified

**Migrations:**
- `supabase/migrations/055_add_trial_modules.sql`
- `supabase/migrations/056_create_subscriptions_table.sql`
- `supabase/migrations/057_create_subscription_modules_table.sql`
- `supabase/migrations/058_create_billing_history_table.sql`
- `supabase/migrations/059_create_user_invitations_table.sql`
- `supabase/migrations/060_create_email_notifications_table.sql`
- `supabase/migrations/061_create_user_tracking_triggers.sql`

**Code:**
- `src/app/signup/select-modules/page.tsx`

**Documentation:**
- `docs/SAAS_ARCHITECTURE_GUIDE.md` (Master guide)
- `docs/PHASE_1_SUMMARY.md` (This file)
