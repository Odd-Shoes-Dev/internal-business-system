# 🎯 Demo-Ready Plan: Core + Tours Only

**Target:** 100 tour company clients  
**Timeline:** 24-48 hours  
**Strategy:** Enable ONLY core accounting + tours module

---

## ✅ What We're Including in Demo

### **Core System (Always Enabled)**
- ✅ Customers
- ✅ Vendors
- ✅ Invoices & Payments
- ✅ Expenses
- ✅ Accounting (Accounts, Journal Entries)
- ✅ Financial Reports
- ✅ User Management
- ✅ Company Settings

### **Tours Module (Target Industry)**
- ✅ Tour Packages
- ✅ Bookings
- ✅ Destinations
- ✅ Tour-specific Reports

---

## ❌ What We're DISABLING for Demo

### **Modules Completely Hidden:**
- ❌ Fleet Management (not available during signup, routes hidden)
- ❌ Hotels (not available during signup, routes hidden)
- ❌ Cafe (not available during signup, routes hidden)
- ❌ Retail (not available during signup, routes hidden)
- ❌ Security (not available during signup, routes hidden)

**Why?** These modules aren't fully tested and add complexity. They're completely hidden from the UI - users won't even know they exist until we enable them later.

**How it works:**
- `availableForSignup: false` in modules.ts
- Registration form only shows Tours module
- Navigation automatically hides disabled module routes
- No "Coming Soon" badges - modules simply don't exist in the UI

---

## 📋 Reduced Scope - What Needs Updating

### **API Routes - CORE (15 files)**
Priority routes for demo:
1. ✅ `/api/customers` - DONE
2. ✅ `/api/vendors` - DONE
3. ✅ `/api/invoices` - DONE
4. ✅ `/api/expenses` - DONE
5. ✅ `/api/employees` - DONE
6. ✅ `/api/accounts` - DONE
7. [ ] `/api/payments` - Need to update
8. [ ] `/api/receipts` - Need to update
9. [ ] `/api/journal-entries` - Need to update
10. [ ] `/api/bank-accounts` - Need to update
11. [ ] `/api/reports/profit-loss` - Need to update
12. [ ] `/api/reports/balance-sheet` - Need to update
13. [ ] `/api/reports/trial-balance` - Need to update
14. [ ] `/api/reports/ar-aging` - Need to update
15. [ ] `/api/reports/customer-statement` - Need to update

### **API Routes - TOURS (3 files)**
1. ✅ `/api/tours` - DONE
2. ✅ `/api/bookings` - DONE
3. [ ] `/api/destinations` - Need to update

**Total: 18 API routes** (8 done, 10 to do) - Much better than 100+!

### **Dashboard Pages - CORE (8 pages)**
1. ✅ `/dashboard/page.tsx` - DONE
2. ✅ `/dashboard/customers/page.tsx` - DONE
3. [ ] `/dashboard/vendors/page.tsx`
4. [ ] `/dashboard/invoices/page.tsx`
5. [ ] `/dashboard/expenses/page.tsx`
6. [ ] `/dashboard/employees/page.tsx`
7. [ ] `/dashboard/accounting/page.tsx`
8. [ ] `/dashboard/reports/page.tsx`

### **Dashboard Pages - TOURS (3 pages)**
1. ✅ `/dashboard/tours/page.tsx` - DONE
2. ✅ `/dashboard/bookings/page.tsx` - DONE
3. [ ] `/dashboard/destinations/page.tsx`

**Total: 11 dashboard pages** (4 done, 7 to do) - Much better than 30+!

---

## 🚀 Execution Plan - 24 Hours

### **Phase 1: Database & Config (1 hour)**

#### Step 1: Run Migrations
```bash
supabase migration up
```

#### Step 2: Disable Unused Modules in Code
Update `src/lib/modules.ts`:
```typescript
export const AVAILABLE_MODULES = [
  {
    id: 'tours',
    name: 'Tours & Safaris',
    availableForSignup: true  // ✅ VISIBLE
  },
  {
    id: 'fleet',
    name: 'Fleet Management',
    availableForSignup: false  // ❌ COMPLETELY HIDDEN
  },
  // ... other modules also set to false
];
```

✅ **DONE** - Already configured in your codebase!

#### Step 3: Verify UI
- Registration form shows only Tours module
- No mention of disabled modules anywhere
- Clean, focused interface

**Status:** [ ] DONE

---

### **Phase 2: Update Critical API Routes (4 hours)**

Priority order (use pattern from customers.ts):
```bash
# 1. Payments & Receipts (1 hour)
src/app/api/payments/route.ts
src/app/api/receipts/route.ts

# 2. Accounting (1 hour)
src/app/api/journal-entries/route.ts
src/app/api/bank-accounts/route.ts

# 3. Reports (2 hours)
src/app/api/reports/profit-loss/route.ts
src/app/api/reports/balance-sheet/route.ts
src/app/api/reports/trial-balance/route.ts
src/app/api/reports/ar-aging/route.ts
src/app/api/reports/customer-statement/route.ts

# 4. Tours (30 min)
src/app/api/destinations/route.ts
```

**Pattern for each:**
```typescript
// 1. Add at top of GET/POST
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

const companyId = request.nextUrl.searchParams.get('company_id');
if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 });

// 2. Verify access
const { data: membership } = await supabase
  .from('user_companies')
  .select('id')
  .eq('user_id', user.id)
  .eq('company_id', companyId)
  .single();
if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

// 3. Add to query (RLS will auto-filter but be explicit)
.eq('company_id', companyId)

// 4. Add to INSERT
.insert({ company_id: companyId, ...data })
```

**Status:** [ ] DONE

---

### **Phase 3: Update Dashboard Pages (3 hours)**

Priority order (use pattern from customers/page.tsx):
```bash
# 1. Financial Pages (1.5 hours)
src/app/dashboard/vendors/page.tsx
src/app/dashboard/invoices/page.tsx
src/app/dashboard/expenses/page.tsx

# 2. HR & Accounting (1 hour)
src/app/dashboard/employees/page.tsx
src/app/dashboard/accounting/page.tsx

# 3. Reports & Tours (30 min)
src/app/dashboard/reports/page.tsx
src/app/dashboard/destinations/page.tsx
```

**Pattern for each:**
```typescript
// 1. Import useCompany
import { useCompany } from '@/contexts/company-context';

// 2. Add to component
const { company, loading: companyLoading } = useCompany();

// 3. Update useEffect
useEffect(() => {
  if (company) {
    loadData();
  }
}, [company]);

// 4. Add company check
const loadData = async () => {
  if (!company) return;
  // ... fetch with company.id
};

// 5. Update API calls
fetch(`/api/resource?company_id=${company.id}`)
```

**Status:** [ ] DONE

---

### **Phase 4: Testing (4 hours)**

#### Test 1: Create Demo Companies (1 hour)
```bash
npm run dev

# Create 3 test companies:

Company 1: "Safari Adventures Ltd"
- Email: admin@safariadventures.com
- Modules: Tours ✅
- Add: 5 customers, 3 tours, 2 bookings, 1 invoice

Company 2: "Mountain Trek Safaris"
- Email: admin@mountaintrek.com
- Modules: Tours ✅
- Add: 5 customers, 2 tours, 3 bookings, 2 invoices

Company 3: "Wildlife Expeditions"
- Email: admin@wildlifeexp.com
- Modules: Tours ✅
- Add: 3 customers, 4 tours, 1 booking, 1 invoice
```

#### Test 2: Data Isolation (1 hour)
- [ ] Login to Company 1 → see only Company 1 data
- [ ] Login to Company 2 → see only Company 2 data
- [ ] Try API with wrong company_id → 403 error
- [ ] Switch companies → data switches correctly

#### Test 3: Core Workflows (1 hour)
**For each test company:**
- [ ] Create new customer
- [ ] Create tour package
- [ ] Create booking
- [ ] Generate invoice from booking
- [ ] Record payment
- [ ] View reports (profit/loss, balance sheet)

#### Test 4: Security (1 hour)
- [ ] Create user in Company 1
- [ ] Try accessing Company 2 data → blocked
- [ ] Check RLS policies in database
- [ ] Test without company_id → error
- [ ] Test without auth → 401

**Status:** [ ] DONE

---

### **Phase 5: Polish & Deploy (2 hours)**

#### Polish (1 hour)
- [ ] Update email templates (remove "Breco Safaris")
- [ ] Add loading states to all pages
- [ ] Fix any console errors
- [ ] Update company registration to only show Tours module

#### Deploy (1 hour)
```bash
# 1. Commit
git add .
git commit -m "feat: demo-ready multi-tenant with tours module"
git push

# 2. Deploy
vercel deploy --prod

# 3. Run production migrations
supabase link --project-ref PROD_REF
supabase migration up

# 4. Create 5 demo companies with sample data
```

**Status:** [ ] DONE

---

## 📊 Time Breakdown

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Database & Config | 1h | [ ] |
| 2 | Update API Routes | 4h | [ ] |
| 3 | Update Dashboard Pages | 3h | [ ] |
| 4 | Testing | 4h | [ ] |
| 5 | Polish & Deploy | 2h | [ ] |
| **Total** | | **14h** | **0%** |

**Timeline:** 2 work days (7 hours each)

---

## ✅ Demo Readiness Checklist

### Before Inviting Clients:
- [ ] Migrations run successfully
- [ ] 10 critical API routes updated
- [ ] 7 critical dashboard pages updated
- [ ] 3 test companies created
- [ ] Data isolation verified
- [ ] Core workflows tested
- [ ] Security tested
- [ ] Deployed to production
- [ ] 5 demo companies with sample data
- [ ] Only Tours module visible in UI

### What Clients Will See:
- ✅ Professional multi-tenant platform
- ✅ Only relevant features (Tours + Core)
- ✅ Their company name throughout
- ✅ Only their data
- ✅ Clean, focused interface
- ✅ All core workflows working

### What They WON'T See:
- ❌ Fleet, Hotels, Cafe options (hidden)
- ❌ Unfinished features
- ❌ "Breco Safaris" branding
- ❌ Other companies' data
- ❌ Crashes or errors

---

## 🎯 Success Metrics

**Demo is ready when:**
- [ ] Can create company in < 2 minutes
- [ ] Can create customer → tour → booking → invoice → payment in < 5 minutes
- [ ] No errors in browser console
- [ ] No "Breco Safaris" visible anywhere
- [ ] All 3 test companies show isolated data
- [ ] Financial reports show correct numbers
- [ ] Can switch between companies smoothly

---

## 💡 Quick Wins

### Already Done (50%):
- ✅ Database migrations created
- ✅ Company registration working
- ✅ 8 critical API routes updated
- ✅ 4 critical pages updated
- ✅ Tours module protected
- ✅ Documentation complete

### Need to Do (50%):
- [ ] Run migrations (30 min)
- [ ] 10 API routes (4 hours)
- [ ] 7 dashboard pages (3 hours)
- [ ] Testing (4 hours)
- [ ] Deploy (2 hours)

**Total remaining: 13.5 hours = 2 days**

---

## 🚀 Recommended Schedule

### **Friday (Day 1) - 7 hours**
- **Morning (3h):** Phase 1 + Phase 2 (migrations + API routes)
- **Afternoon (4h):** Phase 3 (dashboard pages)

### **Saturday (Day 2) - 7 hours**
- **Morning (4h):** Phase 4 (testing)
- **Afternoon (3h):** Phase 5 (polish + deploy)

### **Sunday - Launch**
- Invite 10 beta clients
- Monitor for issues
- Get feedback

### **Next Week**
- Fix any issues
- Invite remaining 90 clients
- Add more modules based on demand

---

## 🎉 Why This Works

**Focused Scope:**
- 18 files instead of 130
- Core + Tours only
- Clear deliverables

**Tour Companies Need:**
1. ✅ Customer management
2. ✅ Tour packages
3. ✅ Bookings
4. ✅ Invoicing
5. ✅ Payments
6. ✅ Financial reports

**They DON'T need (yet):**
- ❌ Fleet management
- ❌ Hotel management
- ❌ Cafe operations
- ❌ Retail POS
- ❌ Security tracking

**After Demo:**
- Companies can request additional modules
- You enable modules one-by-one
- Controlled rollout
- Better support

---

## ⚡ Start NOW - First 3 Actions

1. **Run Migrations** (30 min)
   ```bash
   supabase migration up
   ```

2. **Disable Unused Modules** (10 min)
   - Edit `src/lib/modules.ts`
   - Set fleet, hotels, cafe, retail, security to `enabled: false`

3. **Test Current State** (20 min)
   ```bash
   npm run dev
   # Visit: http://localhost:3000/signup/company
   # Create test company
   # See what works, what breaks
   ```

---

**YOU CAN DO THIS IN 2 DAYS! Let's go!** 🚀
