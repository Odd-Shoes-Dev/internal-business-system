# 🔧 TECHNICAL MIGRATION GUIDE: Single → Multi-Tenant

**For Developers: Exact Code Changes Needed**

---

## PHASE 1: DATABASE MIGRATION

### Step 1: Create Companies Table

```sql
-- supabase/migrations/035_multi_tenant_core.sql

-- Main companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Uganda',
  tax_id TEXT,
  registration_number TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT 'UGX',
  fiscal_year_start TEXT DEFAULT '01-01',
  
  -- Subscription
  subscription_status TEXT DEFAULT 'trial', -- trial, active, suspended, cancelled
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  subscription_plan TEXT DEFAULT 'starter',
  
  -- Settings
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-Company relationship (users can belong to multiple companies)
CREATE TABLE user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'user', -- admin, accountant, operations, sales, guide, viewer
  is_primary BOOLEAN DEFAULT false,
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- Enabled modules per company
CREATE TABLE company_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL, -- 'tours', 'cafe', 'retail', 'security'
  enabled BOOLEAN DEFAULT true,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb,
  UNIQUE(company_id, module_id)
);

-- Indexes
CREATE INDEX idx_user_companies_user ON user_companies(user_id);
CREATE INDEX idx_user_companies_company ON user_companies(company_id);
CREATE INDEX idx_company_modules_company ON company_modules(company_id);
CREATE INDEX idx_companies_subdomain ON companies(subdomain);

-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

---

### Step 2: Add company_id to ALL Existing Tables

```sql
-- supabase/migrations/036_add_company_id.sql

-- Add company_id column to every table
ALTER TABLE customers ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE vendors ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE invoices ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE invoice_items ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE receipts ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE expenses ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE bills ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE bank_accounts ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE bank_transactions ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE chart_of_accounts ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE journal_entries ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE journal_entry_lines ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE employees ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE payroll ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE assets ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE inventory_items ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE purchase_orders ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE goods_receipts ADD COLUMN company_id UUID REFERENCES companies(id);

-- Tour-specific tables
ALTER TABLE bookings ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE tour_packages ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE destinations ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE hotels ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE fleet ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE guides ADD COLUMN company_id UUID REFERENCES companies(id);

-- Add NOT NULL constraint after data migration
-- ALTER TABLE customers ALTER COLUMN company_id SET NOT NULL;
-- (repeat for all tables)

-- Create indexes for performance
CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_vendors_company ON vendors(company_id);
CREATE INDEX idx_invoices_company ON invoices(company_id);
CREATE INDEX idx_invoices_company_date ON invoices(company_id, invoice_date DESC);
CREATE INDEX idx_receipts_company ON receipts(company_id);
CREATE INDEX idx_expenses_company ON expenses(company_id);
CREATE INDEX idx_expenses_company_date ON expenses(company_id, expense_date DESC);
CREATE INDEX idx_bills_company ON bills(company_id);
CREATE INDEX idx_bank_accounts_company ON bank_accounts(company_id);
CREATE INDEX idx_bank_transactions_company ON bank_transactions(company_id);
CREATE INDEX idx_chart_of_accounts_company ON chart_of_accounts(company_id);
CREATE INDEX idx_journal_entries_company ON journal_entries(company_id);
CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_payroll_company ON payroll(company_id);
CREATE INDEX idx_assets_company ON assets(company_id);
CREATE INDEX idx_inventory_items_company ON inventory_items(company_id);
CREATE INDEX idx_bookings_company ON bookings(company_id);
CREATE INDEX idx_bookings_company_status ON bookings(company_id, status);
CREATE INDEX idx_tour_packages_company ON tour_packages(company_id);
CREATE INDEX idx_hotels_company ON hotels(company_id);
CREATE INDEX idx_fleet_company ON fleet(company_id);
```

---

### Step 3: Enable Row Level Security (RLS)

```sql
-- supabase/migrations/037_enable_rls.sql

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet ENABLE ROW LEVEL SECURITY;
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's companies
CREATE OR REPLACE FUNCTION auth.user_companies()
RETURNS SETOF UUID AS $$
  SELECT company_id FROM user_companies
  WHERE user_id = auth.uid()
$$ LANGUAGE SQL STABLE;

-- Create RLS policies (repeat for each table)
-- Example for customers table:
CREATE POLICY "Users can view their company's customers"
  ON customers
  FOR SELECT
  USING (company_id IN (SELECT auth.user_companies()));

CREATE POLICY "Users can insert customers for their company"
  ON customers
  FOR INSERT
  WITH CHECK (company_id IN (SELECT auth.user_companies()));

CREATE POLICY "Users can update their company's customers"
  ON customers
  FOR UPDATE
  USING (company_id IN (SELECT auth.user_companies()))
  WITH CHECK (company_id IN (SELECT auth.user_companies()));

CREATE POLICY "Users can delete their company's customers"
  ON customers
  FOR DELETE
  USING (company_id IN (SELECT auth.user_companies()));

-- Repeat similar policies for ALL tables
-- (vendors, invoices, expenses, etc.)

-- Special policy for companies table
CREATE POLICY "Users can view their companies"
  ON companies
  FOR SELECT
  USING (id IN (SELECT auth.user_companies()));

CREATE POLICY "Admins can update their company"
  ON companies
  FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- User-companies policies
CREATE POLICY "Users can view their company memberships"
  ON user_companies
  FOR SELECT
  USING (user_id = auth.uid() OR company_id IN (SELECT auth.user_companies()));

CREATE POLICY "Admins can manage company users"
  ON user_companies
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

---

## PHASE 2: APPLICATION CODE CHANGES

### Step 1: Create Company Context

```typescript
// src/lib/contexts/company-context.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@/lib/supabase/client';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  currency: string;
  subscription_status: string;
}

interface CompanyContextType {
  company: Company | null;
  companies: Company[];
  switchCompany: (companyId: string) => Promise<void>;
  companyModules: string[];
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyModules, setCompanyModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCompanies();
    }
  }, [user]);

  async function loadCompanies() {
    const { data } = await supabase
      .from('user_companies')
      .select('company:companies(*), is_primary')
      .eq('user_id', user.id);

    if (data && data.length > 0) {
      const companiesList = data.map(d => d.company);
      setCompanies(companiesList);

      // Set primary company or first company
      const primary = data.find(d => d.is_primary);
      const currentCompany = primary?.company || companiesList[0];
      
      setCompany(currentCompany);
      await loadModules(currentCompany.id);
    }
    
    setLoading(false);
  }

  async function loadModules(companyId: string) {
    const { data } = await supabase
      .from('company_modules')
      .select('module_id')
      .eq('company_id', companyId)
      .eq('enabled', true);

    setCompanyModules(data?.map(m => m.module_id) || []);
  }

  async function switchCompany(companyId: string) {
    const newCompany = companies.find(c => c.id === companyId);
    if (newCompany) {
      setCompany(newCompany);
      await loadModules(companyId);
      
      // Store in localStorage for persistence
      localStorage.setItem('currentCompanyId', companyId);
    }
  }

  return (
    <CompanyContext.Provider
      value={{ company, companies, switchCompany, companyModules, loading }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider');
  }
  return context;
}
```

---

### Step 2: Update Supabase Client Helper

```typescript
// src/lib/supabase/helpers.ts
import { SupabaseClient } from '@supabase/supabase-js';

// Wrapper to automatically include company_id
export function createCompanyQuery<T>(
  supabase: SupabaseClient,
  table: string,
  companyId: string
) {
  return supabase
    .from(table)
    .select('*')
    .eq('company_id', companyId);
}

// Use in components
export async function getCustomers(supabase: SupabaseClient, companyId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('company_id', companyId)
    .order('name');

  return { data, error };
}

// For inserts, always include company_id
export async function createCustomer(
  supabase: SupabaseClient,
  companyId: string,
  customerData: any
) {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      ...customerData,
      company_id: companyId, // ALWAYS include
    })
    .select()
    .single();

  return { data, error };
}
```

---

### Step 3: Update API Routes

```typescript
// src/app/api/customers/route.ts
import { createRouteHandlerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get company_id from query params or session
  const companyId = request.nextUrl.searchParams.get('company_id');
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
  }

  // Verify user has access to this company
  const { data: membership } = await supabase
    .from('user_companies')
    .select('id')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch customers (RLS will automatically filter by company_id)
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ customers });
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { company_id, ...customerData } = body;

  // Verify access
  const { data: membership } = await supabase
    .from('user_companies')
    .select('id')
    .eq('user_id', user.id)
    .eq('company_id', company_id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Create customer (include company_id)
  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      ...customerData,
      company_id, // Critical: include company_id
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ customer });
}
```

---

### Step 4: Update Components

```typescript
// src/app/dashboard/customers/page.tsx
'use client';

import { useCompany } from '@/lib/contexts/company-context';
import { useEffect, useState } from 'react';

export default function CustomersPage() {
  const { company } = useCompany();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company) {
      fetchCustomers();
    }
  }, [company]);

  async function fetchCustomers() {
    const res = await fetch(`/api/customers?company_id=${company.id}`);
    const data = await res.json();
    setCustomers(data.customers || []);
    setLoading(false);
  }

  if (!company) return <div>Loading...</div>;

  return (
    <div>
      <h1>Customers - {company.name}</h1>
      {/* Rest of component */}
    </div>
  );
}
```

---

## PHASE 3: DATA MIGRATION

### Script to Migrate Existing Breco Data

```typescript
// scripts/migrate-to-multi-tenant.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role to bypass RLS
);

async function migrateToMultiTenant() {
  console.log('Starting migration...');

  // 1. Create Breco Safaris company
  const { data: brecoCompany, error: companyError } = await supabase
    .from('companies')
    .insert({
      name: 'Breco Safaris Ltd',
      subdomain: 'brecosafaris',
      email: 'brecosafaris@gmail.com',
      phone: '+256 782 884 933',
      address: 'Kampala Road Plot 14 Eagen House',
      tax_id: '1014756280',
      registration_number: '80020001634842',
      currency: 'UGX',
      subscription_status: 'active',
    })
    .select()
    .single();

  if (companyError) {
    console.error('Error creating company:', companyError);
    return;
  }

  console.log('Created company:', brecoCompany.id);

  // 2. Update all existing records with company_id
  const tables = [
    'customers',
    'vendors',
    'invoices',
    'invoice_items',
    'receipts',
    'expenses',
    'bills',
    'bank_accounts',
    'bank_transactions',
    'chart_of_accounts',
    'journal_entries',
    'journal_entry_lines',
    'employees',
    'payroll',
    'assets',
    'inventory_items',
    'purchase_orders',
    'goods_receipts',
    'bookings',
    'tour_packages',
    'destinations',
    'hotels',
    'fleet',
    'guides',
  ];

  for (const table of tables) {
    console.log(`Updating ${table}...`);
    
    const { error } = await supabase
      .from(table)
      .update({ company_id: brecoCompany.id })
      .is('company_id', null);

    if (error) {
      console.error(`Error updating ${table}:`, error);
    } else {
      console.log(`✓ Updated ${table}`);
    }
  }

  // 3. Link existing users to Breco company
  const { data: users } = await supabase.auth.admin.listUsers();

  for (const user of users.users) {
    await supabase.from('user_companies').insert({
      user_id: user.id,
      company_id: brecoCompany.id,
      role: 'admin', // Make existing users admins
      is_primary: true,
    });
  }

  // 4. Enable tour modules for Breco
  await supabase.from('company_modules').insert([
    { company_id: brecoCompany.id, module_id: 'tours', enabled: true },
    { company_id: brecoCompany.id, module_id: 'fleet', enabled: true },
    { company_id: brecoCompany.id, module_id: 'hotels', enabled: true },
  ]);

  console.log('Migration complete!');
}

migrateToMultiTenant();
```

Run with:
```bash
npx ts-node scripts/migrate-to-multi-tenant.ts
```

---

## TESTING CHECKLIST

- [ ] User A from Company A cannot see Company B data
- [ ] User A from Company A cannot update Company B data
- [ ] User A from Company A cannot delete Company B data
- [ ] User can belong to multiple companies
- [ ] User can switch between companies
- [ ] RLS policies work for all tables
- [ ] Company registration creates default data
- [ ] All existing features work for each company independently
- [ ] Performance is acceptable (< 500ms queries)
- [ ] Backups include all company data

---

## ROLLBACK PLAN

If migration fails:

1. Restore database from backup
2. Revert code changes
3. Investigate issue
4. Fix and re-attempt

**Always test on staging first!**
