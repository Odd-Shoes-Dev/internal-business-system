# 🔄 Quick Reference: Updating Files for Multi-Tenancy

This guide shows you exactly how to update each type of file in your codebase.

---

## ✅ Files Already Updated

1. ✅ `src/app/layout.tsx` - Added CompanyProvider, removed Breco branding
2. ✅ `src/contexts/company-context.tsx` - Created company context
3. ✅ `src/lib/company-settings.ts` - Company utilities (updated)
4. ✅ `src/lib/modules.ts` - Module definitions
5. ✅ `src/components/module-guard.tsx` - Module access control
6. ✅ `src/app/signup/company/page.tsx` - Company registration page
7. ✅ `src/app/api/companies/register/route.ts` - Registration API
8. ✅ `src/app/api/customers/route.ts` - Example multi-tenant API (GET & POST)

---

## 📋 Pattern 1: API Routes (Server-side)

### Before (Single-tenant):
```typescript
// src/app/api/RESOURCE/route.ts
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('customers')
    .select('*');
    
  return NextResponse.json({ data });
}
```

### After (Multi-tenant):
```typescript
// src/app/api/RESOURCE/route.ts
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  // 2. Get company_id from query params
  const companyId = request.nextUrl.searchParams.get('company_id');
  if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 });
  
  // 3. Verify user access
  const { data: membership } = await supabase
    .from('user_companies')
    .select('id')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .single();
    
  if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  
  // 4. Query (RLS automatically filters by company_id)
  const { data } = await supabase
    .from('customers')
    .select('*');
    
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await request.json();
  const { company_id, ...resourceData } = body;
  
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 });
  
  // 2. Verify user access
  const { data: membership } = await supabase
    .from('user_companies')
    .select('id')
    .eq('user_id', user.id)
    .eq('company_id', company_id)
    .single();
    
  if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  
  // 3. Insert with company_id (important!)
  const { data, error } = await supabase
    .from('customers')
    .insert({
      ...resourceData,
      company_id  // Must include!
    })
    .select()
    .single();
    
  return NextResponse.json({ data });
}
```

### Apply this pattern to:
- `src/app/api/customers/route.ts` ✅ Done
- `src/app/api/vendors/route.ts`
- `src/app/api/invoices/route.ts`
- `src/app/api/expenses/route.ts`
- `src/app/api/bookings/route.ts`
- `src/app/api/employees/route.ts`
- ... all API routes

---

## 📋 Pattern 2: Dashboard Pages (Client-side)

### Before (Single-tenant):
```typescript
// src/app/dashboard/customers/page.tsx
'use client';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  
  useEffect(() => {
    fetchCustomers();
  }, []);
  
  async function fetchCustomers() {
    const res = await fetch('/api/customers');
    const data = await res.json();
    setCustomers(data.data);
  }
  
  return <div>{/* render customers */}</div>;
}
```

### After (Multi-tenant):
```typescript
// src/app/dashboard/customers/page.tsx
'use client';

import { useCompany } from '@/contexts/company-context';

export default function CustomersPage() {
  const { company, loading } = useCompany();
  const [customers, setCustomers] = useState([]);
  
  useEffect(() => {
    if (company) {
      fetchCustomers();
    }
  }, [company]);
  
  async function fetchCustomers() {
    // Include company_id in request
    const res = await fetch(`/api/customers?company_id=${company!.id}`);
    const data = await res.json();
    setCustomers(data.data);
  }
  
  // Handle loading state
  if (loading) return <div>Loading...</div>;
  if (!company) return <div>No company selected</div>;
  
  return <div>{/* render customers */}</div>;
}
```

### Apply this pattern to:
- `src/app/dashboard/customers/page.tsx`
- `src/app/dashboard/vendors/page.tsx`
- `src/app/dashboard/invoices/page.tsx`
- `src/app/dashboard/expenses/page.tsx`
- `src/app/dashboard/employees/page.tsx`
- ... all dashboard pages

---

## 📋 Pattern 3: Components with Company Info

### Before (Hardcoded):
```typescript
// Any component
export function InvoicePDF() {
  return (
    <div>
      <h1>Breco Safaris Ltd</h1>
      <p>Kampala Road Plot 14...</p>
      <p>+256 782 884 933</p>
    </div>
  );
}
```

### After (Dynamic):
```typescript
// Any component
import { useCompany } from '@/contexts/company-context';

export function InvoicePDF() {
  const { company } = useCompany();
  
  return (
    <div>
      <h1>{company?.name}</h1>
      <p>{company?.address}</p>
      <p>{company?.phone}</p>
    </div>
  );
}
```

### Apply to:
- Navigation headers
- Footers
- Invoice PDFs
- Receipt PDFs
- Email templates
- Any component showing company info

---

## 📋 Pattern 4: Module-Specific Pages

### Wrap module pages with ModuleGuard:
```typescript
// src/app/dashboard/bookings/page.tsx
'use client';

import { ModuleGuard } from '@/components/module-guard';

export default function BookingsPage() {
  return (
    <ModuleGuard module="tours">
      {/* Your bookings content */}
    </ModuleGuard>
  );
}
```

### Apply to:
- `src/app/dashboard/bookings/*` - tours module
- `src/app/dashboard/tours/*` - tours module
- `src/app/dashboard/fleet/*` - fleet module
- `src/app/dashboard/hotels/*` - hotels module
- `src/app/dashboard/cafe/*` - cafe module

---

## 📋 Pattern 5: Forms (Creating Records)

### Always include company_id in form submissions:
```typescript
async function handleSubmit(formData) {
  const { company } = useCompany();
  
  const response = await fetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...formData,
      company_id: company.id  // Always include!
    })
  });
}
```

---

## 🔍 Finding Files to Update

### Search for hardcoded company references:
```bash
# In VS Code, search for:
"Breco Safaris"
"brecosafaris@gmail.com"
"+256 782 884 933"
"1014756280"
"Kampala Road"
```

### Search for API calls missing company_id:
```bash
# Search for:
fetch('/api/customers')
fetch('/api/invoices')
supabase.from('customers')
```

---

## ⚠️ Common Mistakes to Avoid

1. **Forgetting company_id in POST/PUT requests**
   - Always include `company_id` when creating/updating records

2. **Not verifying user access in API routes**
   - Always check user belongs to company before operations

3. **Trusting client-provided company_id**
   - Always verify on server-side

4. **Not handling loading states**
   - Company context loads async, check `loading` state

5. **Hard-coding company info**
   - Always use `company` from context

---

## ✅ Testing Checklist

After updating a file:
- [ ] Create 2 test companies
- [ ] Add different data to each
- [ ] Verify Company A cannot see Company B's data
- [ ] Check API returns correct data
- [ ] Test creating new records
- [ ] Verify data appears in correct company

---

## 🎯 Priority Order

**Update in this order:**
1. ✅ Core files (contexts, helpers) - Done
2. ✅ Registration flow - Done
3. ⏳ API routes (start with most-used: customers, invoices, bookings)
4. ⏳ Dashboard pages (corresponding to APIs)
5. ⏳ Components (headers, navigation, PDFs)
6. ⏳ Less-used features
7. ⏳ Testing

---

**You have the patterns. Now apply them across the codebase! 🚀**
