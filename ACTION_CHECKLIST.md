# 🎯 Immediate Action Checklist

**Priority Order - Do These First**

---

## ⚡ CRITICAL - Do Right Now (30 minutes)

### 1. Run Database Migrations
```bash
cd c:\Users\HP\Desktop\tour-system

# Connect to Supabase
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations (DO NOT SKIP ANY)
supabase migration up

# Expected output:
# ✓ 042_multi_tenant_core.sql
# ✓ 043_add_company_id_columns.sql
# ✓ 044_migrate_existing_data.sql
# ✓ 045_enable_rls_policies.sql
# ✓ 046_cafe_module_rls.sql
```

**⚠️ WARNING:** This adds company_id to ALL tables and enables RLS. Cannot be undone easily.

**Status:** [ ] DONE

---

## 🚀 HIGH PRIORITY - Do Today (2-3 hours)

### 2. Test Company Registration
```bash
# Start dev server
npm run dev

# Open browser
http://localhost:3000/signup/company

# Create Company #1
Name: Safari Tours Ltd
Email: admin@safaritours.com
Phone: +256 700 000 001
Modules: ✅ Tours, ✅ Fleet

# Create Company #2
Name: Mountain Cafe
Email: admin@mountaincafe.com
Phone: +256 700 000 002
Modules: ✅ Cafe

# Verify both companies created in database
# Check: companies, user_companies, company_modules tables
```

**Status:** [ ] DONE

### 3. Test Data Isolation (CRITICAL SECURITY TEST)
```bash
# Login to Company #1 (Safari Tours)
# Create:
- 5 customers
- 3 tour packages
- 2 bookings

# Login to Company #2 (Mountain Cafe)
# Create:
- 5 different customers
- Cafe sales records

# Switch back to Company #1
# VERIFY: You CANNOT see Mountain Cafe's customers
# VERIFY: You CAN see your Safari Tours customers

# Try API hack (should fail):
curl "http://localhost:3000/api/customers?company_id=<mountain_cafe_id>" \
  -H "Authorization: Bearer <safari_tours_token>"
# Expected: 403 Forbidden
```

**Status:** [ ] DONE

### 4. Update Remaining API Routes

**Option A - Automated (FASTER):**
```bash
node scripts/update-multi-tenant.js
git diff src/app/api/
# Review changes, fix any issues
```

**Option B - Manual (5-10 files per hour):**
```bash
# Follow pattern from:
src/app/api/customers/route.ts

# Priority order:
1. src/app/api/payments/route.ts
2. src/app/api/journal-entries/route.ts
3. src/app/api/receipts/route.ts
4. src/app/api/bank-accounts/route.ts
5. src/app/api/reports/**/route.ts
```

**Status:** [ ] DONE

---

## 📋 MEDIUM PRIORITY - Do This Week (5-8 hours)

### 5. Update Dashboard Pages
Priority order:
```
1. [ ] src/app/dashboard/vendors/page.tsx
2. [ ] src/app/dashboard/invoices/page.tsx
3. [ ] src/app/dashboard/expenses/page.tsx
4. [ ] src/app/dashboard/employees/page.tsx
5. [ ] src/app/dashboard/bookings/page.tsx
6. [ ] src/app/dashboard/reports/**/page.tsx
7. [ ] src/app/dashboard/accounting/**/page.tsx
```

**Pattern:** Copy from `src/app/dashboard/customers/page.tsx`

**Status:** [ ] In Progress

### 6. Update Email Templates
```typescript
// File: src/lib/email/resend.ts

// Before:
<h1>Breco Safaris Ltd</h1>

// After:
<h1>{company.name}</h1>

// Update functions to accept company parameter:
export async function sendInvoiceEmail(
  company: Company,  // ADD THIS
  to: string,
  invoiceNumber: string,
  ...
)
```

**Status:** [ ] TODO

### 7. Add Module Guards to Pages
```typescript
// Tours pages (already done):
✅ src/app/dashboard/tours/page.tsx

// Need to add to:
[ ] src/app/dashboard/bookings/page.tsx - module="tours"
[ ] src/app/dashboard/fleet/page.tsx - module="fleet"
[ ] src/app/dashboard/hotels/page.tsx - module="hotels"  
[ ] src/app/dashboard/cafe/page.tsx - module="cafe"
```

**Pattern:** See `src/app/dashboard/tours/page.tsx`

**Status:** [ ] In Progress

---

## 🧪 TESTING - Do Before Launch (3-4 hours)

### 8. Manual Test Suite

#### Test 1: Multi-Company Data Isolation
- [ ] Create Company A and Company B
- [ ] Add 10 customers to Company A
- [ ] Add 10 customers to Company B
- [ ] Login to Company A → see only Company A customers
- [ ] Login to Company B → see only Company B customers
- [ ] API test: Try accessing Company B data with Company A token → 403

#### Test 2: Multi-User Same Company
- [ ] Create Company C
- [ ] Add User 1 as admin
- [ ] Manually add User 2 to user_companies table
- [ ] Login as User 1 → create invoice
- [ ] Login as User 2 → see same invoice
- [ ] Both users see same data

#### Test 3: Module Access Control
- [ ] Create company with only "tours" module enabled
- [ ] Visit /dashboard/tours → accessible
- [ ] Visit /dashboard/cafe → "Module Not Enabled" message
- [ ] Enable cafe module via SQL
- [ ] Refresh → cafe now accessible

#### Test 4: Company Switching
- [ ] User belongs to Company A and Company B
- [ ] Login → see company selector
- [ ] Select Company A → see Company A data
- [ ] Switch to Company B → see Company B data
- [ ] Switch back → Company A data still there

#### Test 5: Registration Flow
- [ ] Go to /signup/company
- [ ] Fill form with valid data
- [ ] Select modules
- [ ] Submit
- [ ] Verify: company created, user created, modules enabled
- [ ] Login → see dashboard

**Status:** [ ] TODO

---

## 📦 DEPLOYMENT - Do When Ready (1-2 hours)

### 9. Production Deployment
```bash
# 1. Commit all changes
git add .
git commit -m "feat: multi-tenant architecture complete"
git push origin main

# 2. Deploy to Vercel/Netlify
vercel deploy --prod

# 3. Run migrations on PRODUCTION database
supabase link --project-ref PROD_PROJECT_REF
supabase migration up

# 4. Create first production company
# Visit: https://yourdomain.com/signup/company

# 5. Verify production
curl https://yourdomain.com/api/customers?company_id=UUID
```

**Status:** [ ] TODO

---

## 🎓 LEARNING - Optional

### 10. Review Key Files (Understanding)
- [ ] Read: `supabase/migrations/042_multi_tenant_core.sql`
- [ ] Read: `supabase/migrations/045_enable_rls_policies.sql`
- [ ] Read: `src/contexts/company-context.tsx`
- [ ] Read: `src/lib/modules.ts`
- [ ] Read: `src/app/api/customers/route.ts` (example)
- [ ] Read: `docs/platform-transformation/UPDATE_PATTERNS.md`

### 11. Documentation Review
- [ ] Read: `MULTI_TENANT_COMPLETE.md` - Overview
- [ ] Read: `docs/platform-transformation/00_CRITICAL_2DAY_LAUNCH.md`
- [ ] Read: `docs/platform-transformation/03_TECHNICAL_MIGRATION_GUIDE.md`

---

## ✅ Success Indicators

You'll know you're done when:
- ✅ Migrations completed successfully
- ✅ Can create multiple companies
- ✅ Each company sees only their data
- ✅ Module guards work correctly
- ✅ No "Breco Safaris" in visible UI
- ✅ All tests pass
- ✅ Production deployment successful

---

## 🆘 Problems? Quick Fixes

### Migration Fails
```bash
supabase migration list  # Check status
supabase migration down  # Rollback if needed
# Fix SQL error
supabase migration up    # Retry
```

### Data Bleeding Between Companies
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'customers';

-- Verify user_companies
SELECT * FROM user_companies;

-- Test RLS
SET LOCAL auth.uid TO '<user_id>';
SELECT * FROM customers;  -- Should only see user's company data
```

### Module Guard Not Working
```typescript
// Verify in src/components/module-guard.tsx
// Check company_modules table
SELECT * FROM company_modules;
```

---

## 📊 Progress Tracking

**Overall Progress:**
- [✅] Database migrations created
- [✅] Core context & utilities created
- [✅] Company registration flow created
- [✅] 8 critical API routes updated
- [✅] 2 dashboard pages updated
- [✅] Module guards added to tours
- [✅] Branding removed from config files
- [ ] Migrations run on database
- [ ] All API routes updated
- [ ] All dashboard pages updated
- [ ] Email templates updated
- [ ] Full testing completed
- [ ] Production deployed

**Current Status:** 65% Complete → Need to run migrations and test!

**Time Remaining:** 4-6 hours (with testing)

---

## 🎯 Your Next 3 Actions (Right Now!)

1. **Run Migrations** (10 min)
   ```bash
   supabase migration up
   ```

2. **Create 2 Companies** (10 min)
   ```bash
   npm run dev
   # Visit: http://localhost:3000/signup/company
   ```

3. **Test Data Isolation** (10 min)
   ```bash
   # Add customers to both companies
   # Verify they can't see each other's data
   ```

**START HERE:** ⬆️ Do these 3 things first!

---

**Last Updated:** January 24, 2026  
**Status:** Ready for migration and testing  
**Action Required:** Run database migrations
