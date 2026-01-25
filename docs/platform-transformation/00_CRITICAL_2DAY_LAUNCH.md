# 🚨 CRITICAL 2-DAY LAUNCH PLAN (100 Tour Clients)

**Launch Date:** January 26, 2026  
**Current Date:** January 24, 2026  
**Time Available:** 48 hours  
**Target:** 100 tour companies testing with REAL DATA

---

## ⚠️ REALITY CHECK

**What's Possible in 2 Days:**
- ✅ Multi-tenant database structure
- ✅ Company onboarding flow
- ✅ Remove Breco hardcoding
- ✅ Basic white-labeling
- ✅ User registration per company

**What's NOT Possible in 2 Days:**
- ❌ Full modular system with feature flags
- ❌ Subdomain routing per company
- ❌ Advanced billing system
- ❌ Perfect UI polish
- ❌ Complete testing

**Strategy:** Ship multi-tenant MVP → Iterate with real user feedback

---

## 🎯 HOUR-BY-HOUR BREAKDOWN

### DAY 1 (January 24, 2026) - DATABASE & CORE

#### Hours 0-4: Multi-Tenant Database Migration
**Priority:** CRITICAL - Cannot have 100 separate databases

**Tasks:**
1. Create `companies` table
2. Add `company_id` to ALL existing tables
3. Set up Row Level Security (RLS) policies
4. Create `user_companies` junction table
5. Test data isolation thoroughly

**Files to Create:**
- `supabase/migrations/035_multi_tenant_core.sql`
- `supabase/migrations/036_multi_tenant_rls.sql`

**Testing Checklist:**
- [ ] User from Company A cannot see Company B's data
- [ ] User from Company A cannot modify Company B's data
- [ ] Admin queries work with service role
- [ ] All existing features still work for single company

---

#### Hours 4-8: Remove Breco Hardcoding

**Priority:** HIGH - System must be generic

**Tasks:**
1. Replace hardcoded company info with `company_settings` table
2. Update all components to fetch from database
3. Remove "Breco Safaris" from:
   - README.md
   - Navigation/headers
   - Email templates
   - PDF templates
   - Meta tags

**Files to Update:**
- `src/lib/company-settings.ts` - Create settings fetch functions
- `src/components/layout/*` - Dynamic company name/logo
- `src/lib/pdf/*` - Dynamic company info in PDFs
- `src/lib/email/*` - Dynamic email templates
- `README.md` - Generic system name

**Testing:**
- [ ] Company A sees their name/logo
- [ ] Company B sees their name/logo
- [ ] Invoices show correct company info per tenant

---

#### Hours 8-12: Company Onboarding System

**Priority:** CRITICAL - How clients sign up

**Tasks:**
1. Create company registration page
2. Create first-time setup wizard
3. Auto-create default accounts/settings
4. Welcome email with login instructions

**Pages to Create:**
- `/signup/company` - Company registration form
- `/onboarding` - Setup wizard (company info, first admin user)
- `/api/companies/register` - Registration API

**Setup Wizard Steps:**
1. Company details (name, address, phone, email)
2. Logo upload
3. Admin user creation
4. Currency & accounting settings
5. Chart of accounts setup (use default template)

**Testing:**
- [ ] Can register new company
- [ ] First user becomes admin
- [ ] Default settings created
- [ ] Can immediately start using system

---

### DAY 2 (January 25, 2026) - INTEGRATION & TESTING

#### Hours 12-16: Authentication Updates

**Priority:** CRITICAL - Users must login to correct company

**Tasks:**
1. Update login flow to select company
2. Store company context in session
3. Update middleware to enforce company access
4. Create company selector for users in multiple companies

**Files to Update:**
- `src/app/login/page.tsx` - Add company selection
- `src/middleware.ts` - Add company context
- `src/lib/supabase/client.ts` - Include company_id in queries

**Flow:**
```
User enters email/password
→ System checks which companies they belong to
→ If 1 company: auto-login
→ If multiple: show company selector
→ Set company_id in session
→ All queries filtered by company_id via RLS
```

---

#### Hours 16-20: Testing & Bug Fixes

**Priority:** CRITICAL - Must work reliably

**Tasks:**
1. Create 5 test companies with sample data
2. Test all major workflows per company:
   - Create booking
   - Create invoice
   - Record payment
   - Create expense
   - Generate reports
   - Add employee
3. Verify data isolation between companies
4. Fix any critical bugs

**Test Companies:**
- Safari Adventures Ltd
- Uganda Tours & Travel
- Gorilla Trek Safaris
- Lake Victoria Expeditions
- Mountain Hiking Tours

---

#### Hours 20-24: Documentation & Launch Prep

**Priority:** HIGH - Clients need instructions

**Tasks:**
1. Update README with new system name
2. Create client welcome email template
3. Create quick start guide (PDF)
4. Prepare demo video (5-10 min screen recording)
5. Set up support email/WhatsApp

**Documents to Create:**
- `docs/CLIENT_ONBOARDING_GUIDE.md`
- `docs/QUICK_START_TOUR_COMPANIES.md`
- Email template with login instructions
- Video: "How to Register & Start Using the System"

---

## 🚀 LAUNCH CHECKLIST (Before Sending to 100 Clients)

### Database
- [ ] Multi-tenant tables created
- [ ] RLS policies active on ALL tables
- [ ] Data isolation tested (Company A ≠ Company B)
- [ ] Backup strategy in place
- [ ] Database indices optimized

### Authentication
- [ ] Company registration works
- [ ] Login with company selection works
- [ ] Password reset works
- [ ] Email verification works (optional for MVP)

### Core Features (Per Company)
- [ ] Create customers
- [ ] Create tour bookings
- [ ] Generate invoices
- [ ] Record payments
- [ ] Create expenses
- [ ] Add employees
- [ ] Generate reports (P&L, Balance Sheet)
- [ ] All features isolated per company

### White-Labeling
- [ ] Breco Safaris removed from all visible areas
- [ ] System name updated (decide: TourOS? SafariHub?)
- [ ] Company logo/name shows in navigation
- [ ] Company info on invoices/receipts
- [ ] Generic welcome emails

### Documentation
- [ ] README updated
- [ ] Client onboarding guide ready
- [ ] Quick start PDF ready
- [ ] Demo video recorded
- [ ] Support contact info ready

### Infrastructure
- [ ] Deployed to production (Vercel/similar)
- [ ] Domain name ready (yoursystem.com)
- [ ] SSL certificate active
- [ ] Email sending configured (Resend)
- [ ] Error monitoring setup (optional but recommended)

---

## 📧 CLIENT COMMUNICATION PLAN

### Email Template (Send to 100 clients)

**Subject:** [Your System Name] - Start Managing Your Tour Business Digitally

**Body:**
```
Hi [Tour Company Name],

Your comprehensive tour operations & financial management system is ready!

🎉 What You Can Do:
✅ Manage bookings (safaris, hotels, vehicles)
✅ Generate professional invoices
✅ Track payments and customer balances
✅ Record expenses and bills
✅ Manage employees and payroll
✅ Generate financial reports
✅ Full accounting with chart of accounts

📋 Getting Started (5 minutes):

1. Visit: https://yoursystem.com/signup/company
2. Register your company
3. Create your admin account
4. Start adding your data!

📹 Watch Demo Video: [link]
📖 Quick Start Guide: [link]

💬 Need Help?
- Email: support@yoursystem.com
- WhatsApp: +256 XXX XXX XXX

This is a BETA testing phase - we want your feedback!

Best regards,
[Your Name]
[Your Company Name]
```

---

## 🚨 KNOWN LIMITATIONS (Communicate to Clients)

**What's Working:**
- ✅ All core tour & finance features
- ✅ Multi-company data isolation
- ✅ Invoicing, payments, bookings
- ✅ Reports and accounting

**What's Coming Soon (30 days):**
- ⏳ Custom subdomains (companyA.yoursystem.com)
- ⏳ Advanced feature flags
- ⏳ Mobile app
- ⏳ Advanced analytics dashboard
- ⏳ WhatsApp integration
- ⏳ Automated billing

**Current Limitations:**
- ⚠️ All companies use same domain (filtered by login)
- ⚠️ Some UI still references generic "company" instead of specific name
- ⚠️ Limited customization per company
- ⚠️ Manual onboarding (no automated billing yet)

---

## 🆘 EMERGENCY CONTACTS & ROLLBACK PLAN

### If Critical Bug Found:
1. Identify scope (all companies or specific one?)
2. Quick fix if possible
3. If major: disable company registration temporarily
4. Communicate transparently to affected clients

### Rollback Plan:
- Database backup before migration
- Keep old single-tenant code in git branch
- Can restore individual company if needed

### Support Strategy:
- Respond within 1 hour during business hours
- Create WhatsApp group for beta testers
- Weekly feedback sessions
- Prioritize critical bugs over new features

---

## 💰 PRICING READY? (Note for After Launch)

**Recommended for Tour Companies:**

**Setup Fee:** $300-500 (one-time)
- Company setup
- Data migration assistance
- 1 hour training

**Monthly Subscription:** $50-150/month
- Up to 10 users
- All tour features included
- Email support
- Regular updates

**Add-ons:**
- Extra users: $10/user/month
- Premium support: $50/month
- Custom integrations: Quote on request
- Training: $50/hour

**Note:** Don't enforce payment in first 30 days (beta testing period)

---

## ✅ SUCCESS METRICS (First 7 Days)

**Target:**
- [ ] 50+ companies register
- [ ] 30+ companies actively using (create data)
- [ ] <10 critical bugs reported
- [ ] 80%+ positive feedback
- [ ] 0 data leak incidents

**Track:**
- Daily registrations
- Active users per company
- Feature usage (bookings, invoices created)
- Support tickets
- User feedback

---

## NEXT PHASE

After 2-day launch → See `01_30DAY_REFINEMENT.md` for next steps
