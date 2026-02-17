# Database Migration Guide - Module System Fix

## 🎯 What This Does

These migrations fix the module system architecture by:
1. **072**: Updates signup trigger to stop inserting wrong module IDs
2. **073**: Migrates your existing module data from `company_modules` to `subscription_modules`

## ⚠️ IMPORTANT - Read Before Running

- **Your data is safe**: We migrate, not delete
- **No downtime needed**: Can run on live database
- **Preserves all selections**: Your existing module choices are kept
- **Reversible**: Can rollback if needed (see VERIFY_MODULE_MIGRATION.sql)

## 📋 Step-by-Step Instructions

### Step 1: Backup Your Database (Optional but Recommended)

```bash
# Using Supabase CLI
supabase db dump > backup_before_module_migration.sql
```

Or use Supabase Dashboard → Database → Backups

### Step 2: Verify Current State

Run queries from `VERIFY_MODULE_MIGRATION.sql` (Section: BEFORE MIGRATION)

**Expected:** You'll see records in `company_modules` table

### Step 3: Apply Migrations

**Option A: Using Supabase CLI** (Recommended)

```bash
# Push new migrations to database
supabase db push

# Or run specific migrations
supabase migration up
```

**Option B: Using Supabase Dashboard**

1. Go to SQL Editor in Supabase Dashboard
2. Load `072_fix_signup_trigger_no_modules.sql`
3. Click "RUN"
4. Load `073_migrate_to_subscription_modules.sql` 
5. Click "RUN"

**Option C: Using psql**

```bash
psql "your-connection-string" -f supabase/migrations/072_fix_signup_trigger_no_modules.sql
psql "your-connection-string" -f supabase/migrations/073_migrate_to_subscription_modules.sql
```

### Step 4: Verify Migration Success

Run queries from `VERIFY_MODULE_MIGRATION.sql` (Section: AFTER MIGRATION)

**Expected Results:**
- Industry modules now in `subscription_modules` table
- Each company shows 6 core modules + their industry modules in `company_enabled_modules` view
- No failed migrations (query #8 should return 0 rows)
- No duplicates (query #9 should return 0 rows)

### Step 5: Test the System

1. **Test Existing Company:**
   - Login to existing company
   - Verify dashboard shows correct navigation
   - Check enabled modules are visible

2. **Test New Signup:**
   - Create new test account
   - Select modules during signup
   - Verify company created successfully
   - Check modules appear in `subscription_modules` table

3. **Test Module Toggle:**
   - Try enabling/disabling a module
   - Verify changes reflect in navigation
   - Check `subscription_modules` table updates

## 📊 What Changed

### Before (Old System)
```
company_modules table:
- accounting, invoicing, expenses → ❌ Wrong IDs
- tours, fleet, hotels → ✅ But in wrong table
```

### After (New System)
```
Core Features (always enabled, no table):
- Accounting, Invoicing, Expenses, Customers, Vendors, Reports

subscription_modules table:
- tours, fleet, hotels, cafe, inventory, payroll, retail, security
- With pricing, currency, Stripe integration
```

## 🔧 Troubleshooting

### Problem: Migration fails with "subscription_modules table does not exist"

**Solution:** Run migration 057 first:
```bash
psql "your-connection-string" -f supabase/migrations/057_create_subscription_modules_table.sql
```

### Problem: Some modules didn't migrate

**Check:** Run query #8 from VERIFY_MODULE_MIGRATION.sql

**Fix:** Manually insert missing modules:
```sql
INSERT INTO subscription_modules (company_id, module_id, is_active, monthly_price, currency)
VALUES ('your-company-id', 'tours', true, 39.00, 'USD');
```

### Problem: Frontend still showing wrong data

**Solution:** 
1. Clear browser cache
2. Hard refresh (Ctrl+F5)
3. Check browser console for errors
4. Verify API is using new `subscription_modules` table

### Problem: Need to rollback

**Steps:**
1. Delete migrated data:
   ```sql
   DELETE FROM subscription_modules WHERE created_at >= '2026-02-17';
   DROP VIEW IF EXISTS company_enabled_modules;
   ```
2. Frontend will fall back to `company_modules` (old code still works)

## ✅ Success Indicators

After migration, you should see:

1. ✅ New signups create company without module errors
2. ✅ Existing companies show correct navigation items
3. ✅ Dashboard stats filter by enabled modules
4. ✅ Module enable/disable works correctly
5. ✅ Period locking prevents changes in closed periods
6. ✅ No TypeScript/database errors

## 📞 Need Help?

If you encounter issues:
1. Check the VERIFY_MODULE_MIGRATION.sql queries
2. Look at browser console for frontend errors
3. Check Supabase logs for database errors
4. Review the SYSTEM_AUDIT_REPORT.md for detailed architecture

## 🗑️ Cleanup (Optional - After 2 Weeks)

Once you've verified everything works:

```sql
-- Archive old module data
CREATE TABLE company_modules_archive AS SELECT * FROM company_modules;

-- Drop old table (only after verifying everything works!)
-- DROP TABLE company_modules CASCADE;
```

**Don't rush this** - keep `company_modules` for at least 2 weeks as safety backup.
