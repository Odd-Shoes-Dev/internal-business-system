# 🎨 Multi-Tenant Logo & Company Branding Fix

## Problem Identified
All PDF generators (invoices, receipts, quotations, proformas, bills, payslips) currently have **hardcoded Breco Safaris logo and company information**. In a multi-tenant system, each company needs their own branding on documents.

---

## ✅ Solution Implemented (Invoice Example)

### 1. Updated Invoice PDF Generator
**File:** `src/lib/pdf/invoice.ts`

**Changes:**
- Added `CompanyInfo` interface
- Updated `InvoicePDFData` to include `company` parameter
- Replaced all hardcoded company data with dynamic `data.company.*` fields
- Logo: `${data.company.logo_url ? '<img src="...">': ''}`
- Company details now pull from database

### 2. Updated Invoice PDF API Route
**File:** `src/app/api/invoices/[id]/pdf/route.ts`

**Changes:**
```typescript
// Fetch company info
const { data: company } = await supabase
  .from('companies')
  .select('name, logo_url, email, phone, address, city, country, tax_id, registration_number, website')
  .eq('id', invoice.company_id)
  .single();

// Pass to PDF generator
const pdfData = {
  invoice,
  lineItems,
  customer,
  company, // ← NEW
};
```

---

## 📋 Remaining Files to Update

### **PDF Generators (6 files):**

1. ✅ `src/lib/pdf/invoice.ts` - **DONE**
2. ❌ `src/lib/pdf/quotation.ts` - Need to update
3. ❌ `src/lib/pdf/proforma.ts` - Need to update
4. ❌ `src/lib/pdf/receipt.ts` - Need to update
5. ❌ `src/lib/pdf/bill.ts` - Need to update
6. ❌ `src/lib/pdf/payslip-pdf.ts` - Need to update

### **API Routes (5 files):**

1. ✅ `src/app/api/invoices/[id]/pdf/route.ts` - **DONE**
2. ❌ `src/app/api/receipts/[id]/pdf/route.ts` - Need to update
3. ❌ `src/app/api/bills/[id]/pdf/route.ts` - Need to update
4. ❌ `src/app/api/payslips/[id]/pdf/route.ts` - Need to update
5. ❌ `src/app/api/quotations/[id]/pdf/route.ts` - Need to update (if exists)

---

## 🔧 How to Apply Fix (Copy-Paste Pattern)

### For Each PDF Generator File:

#### Step 1: Add Company Interface (top of file)
```typescript
interface CompanyInfo {
  name: string;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  tax_id: string | null;
  registration_number: string | null;
  website: string | null;
}

interface [Document]PDFData {
  // ... existing fields
  company: CompanyInfo; // ← ADD THIS
}
```

#### Step 2: Replace Hardcoded Logo & Header
**Find:**
```html
<img src="/assets/logo.png" alt="BlueOx" class="logo">
<div class="company-name">BlueOx</div>
<div class="company-details">
  <p>Kampala Road Plot 14...</p>
  <p>Tel: +256 782 884 933...</p>
  <p>Email: brecosafaris@gmail.com...</p>
</div>
```

**Replace with:**
```html
${data.company.logo_url ? `<img src="${data.company.logo_url}" alt="${data.company.name}" class="logo">` : ''}
<div class="company-name">${data.company.name}</div>
<div class="company-details">
  ${data.company.address ? `<p>${data.company.address}</p>` : ''}
  ${data.company.city || data.company.country ? `<p>${[data.company.city, data.company.country].filter(Boolean).join(', ')}</p>` : ''}
  ${data.company.phone ? `<p>Tel: ${data.company.phone}</p>` : ''}
  ${data.company.email ? `<p>Email: ${data.company.email}` : ''}${data.company.website ? ` • Website: ${data.company.website}` : ''}${data.company.email ? `</p>` : ''}
  ${data.company.tax_id ? `<p>TIN: ${data.company.tax_id}` : ''}${data.company.registration_number ? ` • Reg. No: ${data.company.registration_number}` : ''}${data.company.tax_id ? `</p>` : ''}
</div>
```

#### Step 3: Replace Hardcoded Footer
**Find:**
```html
<p>Breco Safaris Ltd • Kampala Road...</p>
<p>Tel: +256 782 884 933...</p>
```

**Replace with:**
```html
<p style="margin-top: 8px;">${data.company.name}${data.company.address ? ` • ${data.company.address}` : ''}${data.company.city || data.company.country ? `, ${[data.company.city, data.company.country].filter(Boolean).join(', ')}` : ''}</p>
${data.company.phone || data.company.email || data.company.website ? `<p>${data.company.phone ? `Tel: ${data.company.phone}` : ''}${data.company.email ? ` • Email: ${data.company.email}` : ''}${data.company.website ? ` • ${data.company.website}` : ''}</p>` : ''}
${data.company.tax_id || data.company.registration_number ? `<p>${data.company.tax_id ? `TIN: ${data.company.tax_id}` : ''}${data.company.registration_number ? ` • Reg. No: ${data.company.registration_number}` : ''}</p>` : ''}
```

### For Each API Route File:

#### Add Company Fetch
**Find:**
```typescript
// Fetch customer
const { data: customer } = await supabase
  .from('customers')
  .select('*')
  .eq('id', invoice.customer_id)
  .single();
```

**Add after:**
```typescript
// Fetch company info
const { data: company } = await supabase
  .from('companies')
  .select('name, logo_url, email, phone, address, city, country, tax_id, registration_number, website')
  .eq('id', invoice.company_id) // OR bill.company_id, receipt.company_id, etc.
  .single();

if (!company) {
  return NextResponse.json(
    { error: 'Company not found' },
    { status: 404 }
  );
}
```

#### Update PDF Data Object
**Find:**
```typescript
const pdfData = {
  invoice, // or bill, receipt, etc.
  lineItems,
  customer,
};
```

**Replace with:**
```typescript
const pdfData = {
  invoice, // or bill, receipt, etc.
  lineItems,
  customer,
  company, // ← ADD THIS
};
```

---

## 🎯 How Companies Upload Logos

### Option 1: Company Settings Page
Add logo upload to `/dashboard/settings/company`:

```typescript
// In company settings form
<input 
  type="file" 
  accept="image/*"
  onChange={handleLogoUpload}
/>

const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('company-logos')
    .upload(`${company.id}/${file.name}`, file);

  if (!error) {
    const logoUrl = supabase.storage
      .from('company-logos')
      .getPublicUrl(data.path).data.publicUrl;

    // Update company record
    await supabase
      .from('companies')
      .update({ logo_url: logoUrl })
      .eq('id', company.id);
  }
};
```

### Option 2: Registration Flow
Add logo upload to `/signup/company`:
- Allow optional logo upload during registration
- Stored in `company-logos` storage bucket
- Public URL saved to `companies.logo_url`

---

## 📦 Storage Setup Required

### Create Supabase Storage Bucket

```sql
-- In Supabase Dashboard > Storage > New Bucket
Name: company-logos
Public: Yes (logos need to be accessible in PDFs)
File size limit: 2MB
Allowed MIME types: image/jpeg, image/png, image/svg+xml
```

### RLS Policies for Storage
```sql
-- Anyone can view logos (public)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- Only company members can upload/update their logo
CREATE POLICY "Company members can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.uid() IN (
    SELECT user_id FROM user_companies 
    WHERE company_id = (storage.foldername(name))[1]::uuid
  )
);
```

---

## ✅ Testing Checklist

After applying fixes:

1. **Upload Logo:** 
   - Go to company settings
   - Upload logo (PNG/JPG, < 2MB)
   - Verify it appears in dashboard

2. **Generate Invoice:**
   - Create test invoice
   - Click "Generate PDF"
   - Verify YOUR company logo appears (not Breco Safaris)
   - Verify YOUR company details appear

3. **Generate Receipt:**
   - Record payment
   - Generate receipt PDF
   - Verify company branding

4. **Test Multiple Companies:**
   - Switch to Company B
   - Generate document
   - Verify Company B logo/details appear (not Company A)

---

## 🚨 Priority Level: HIGH

**Why this matters:**
- Customer-facing documents (invoices, receipts) MUST show correct company branding
- Demo companies will notice if all documents show "Breco Safaris"
- This is a fundamental multi-tenant requirement
- Affects trust and professionalism

**Estimated time to fix all:**
- Remaining 5 PDF generators: ~2 hours
- Remaining 4 API routes: ~1 hour
- Storage bucket setup: ~15 minutes
- Testing: ~30 minutes
- **Total: ~4 hours**

---

## 📝 Quick Start Commands

```bash
# Search for all hardcoded references
grep -r "Breco Safaris" src/lib/pdf/
grep -r "brecosafaris@gmail.com" src/lib/pdf/
grep -r "/assets/logo.png" src/lib/pdf/

# Update all at once (use your editor's find-replace)
# Find: Breco Safaris Ltd
# Replace with: ${data.company.name}
```

---

## ✨ Result After Fix

**Before:** All PDFs show Breco Safaris logo and contact info  
**After:** Each company sees their own logo and details on ALL documents

**This is how true multi-tenant systems work!** 🎉
