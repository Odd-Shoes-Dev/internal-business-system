# Missing Features & Implementation Guide
**Sceneside Financial System**  
Last Updated: December 15, 2025

---

## Overview

This document tracks all missing and partially implemented features in the Sceneside Financial System, with detailed implementation steps for each feature.

---

## 🔴 CRITICAL MISSING FEATURES

### 1. Document Types (Receipt, Quotation, Proforma Invoice)

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** HIGH  
**Requested By:** Client requirement for multiple document types

#### Current State
- System only supports **Invoice** and **Bill** document types
- No way to generate receipts, quotations, or proforma invoices
- PDF templates only exist for invoices

#### What's Missing
- [ ] Database enum for document types
- [ ] Document type field in invoices table
- [ ] UI selector for document type when creating invoice
- [ ] Separate PDF templates for each document type
- [ ] Different numbering sequences for each type
- [ ] Status workflows specific to each type

#### Implementation Steps

**Step 1: Update Database Schema**
```sql
-- File: supabase/migrations/014_add_document_types.sql

-- Create document type enum
CREATE TYPE document_type AS ENUM ('invoice', 'receipt', 'quotation', 'proforma');

-- Add document_type column to invoices table
ALTER TABLE invoices 
ADD COLUMN document_type document_type DEFAULT 'invoice';

-- Add separate number sequences
ALTER TABLE invoices
ADD COLUMN quotation_number VARCHAR(50),
ADD COLUMN proforma_number VARCHAR(50),
ADD COLUMN receipt_number VARCHAR(50);

-- Create unique constraints
CREATE UNIQUE INDEX idx_quotation_number ON invoices(quotation_number) WHERE quotation_number IS NOT NULL;
CREATE UNIQUE INDEX idx_proforma_number ON invoices(proforma_number) WHERE proforma_number IS NOT NULL;
CREATE UNIQUE INDEX idx_receipt_number ON invoices(receipt_number) WHERE receipt_number IS NOT NULL;
```

**Step 2: Create Number Generation Functions**
```sql
-- Add to: supabase/migrations/014_add_document_types.sql

-- Quotation number generator
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS VARCHAR AS $$
DECLARE
  next_number INT;
  new_number VARCHAR;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_number FROM 6) AS INT)), 0) + 1
  INTO next_number
  FROM invoices
  WHERE quotation_number IS NOT NULL;
  
  new_number := 'QUO-' || LPAD(next_number::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Proforma number generator
CREATE OR REPLACE FUNCTION generate_proforma_number()
RETURNS VARCHAR AS $$
DECLARE
  next_number INT;
  new_number VARCHAR;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(proforma_number FROM 5) AS INT)), 0) + 1
  INTO next_number
  FROM invoices
  WHERE proforma_number IS NOT NULL;
  
  new_number := 'PRO-' || LPAD(next_number::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Receipt number generator
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS VARCHAR AS $$
DECLARE
  next_number INT;
  new_number VARCHAR;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 5) AS INT)), 0) + 1
  INTO next_number
  FROM invoices
  WHERE receipt_number IS NOT NULL;
  
  new_number := 'REC-' || LPAD(next_number::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;
```

**Step 3: Update TypeScript Types**
```typescript
// File: src/types/database.ts

// Add to existing Invoice interface:
export interface Invoice {
  // ... existing fields ...
  document_type: 'invoice' | 'receipt' | 'quotation' | 'proforma';
  quotation_number?: string | null;
  proforma_number?: string | null;
  receipt_number?: string | null;
}
```

**Step 4: Update Invoice Creation UI**
```tsx
// File: src/app/dashboard/invoices/new/page.tsx

// Add document type selector at the top of the form:
<div className="form-group">
  <label className="label">Document Type *</label>
  <select
    {...register('document_type', { required: 'Document type is required' })}
    className="input"
  >
    <option value="invoice">Invoice</option>
    <option value="quotation">Quotation</option>
    <option value="proforma">Proforma Invoice</option>
    <option value="receipt">Receipt</option>
  </select>
</div>
```

**Step 5: Create PDF Templates**
```typescript
// File: src/lib/pdf/quotation.ts (NEW FILE)
export function generateQuotationHTML(data: InvoicePDFData): string {
  // Similar to invoice template but with:
  // - "QUOTATION" header instead of "INVOICE"
  // - "Valid Until" date instead of "Due Date"
  // - "Quote Number" instead of "Invoice Number"
  // - Different footer text: "This quotation is valid for 30 days"
}

// File: src/lib/pdf/proforma.ts (NEW FILE)
export function generateProformaHTML(data: InvoicePDFData): string {
  // Similar to invoice but with:
  // - "PROFORMA INVOICE" header
  // - Note: "This is not a tax invoice"
}

// File: src/lib/pdf/receipt.ts (NEW FILE)
export function generateReceiptHTML(data: InvoicePDFData): string {
  // Receipt-specific template with:
  // - "RECEIPT" header
  // - Payment received information
  // - Payment method details
}
```

**Step 6: Update API Routes**
```typescript
// File: src/app/api/invoices/route.ts

// Modify POST handler to generate appropriate number based on document_type:
const documentType = body.document_type || 'invoice';
let documentNumber;

switch (documentType) {
  case 'quotation':
    documentNumber = await supabase.rpc('generate_quotation_number');
    break;
  case 'proforma':
    documentNumber = await supabase.rpc('generate_proforma_number');
    break;
  case 'receipt':
    documentNumber = await supabase.rpc('generate_receipt_number');
    break;
  default:
    documentNumber = await supabase.rpc('generate_invoice_number');
}
```

**Step 7: Update PDF Export Route**
```typescript
// File: src/app/api/invoices/[id]/pdf/route.ts

// Import all PDF generators
import { generateInvoiceHTML } from '@/lib/pdf/invoice';
import { generateQuotationHTML } from '@/lib/pdf/quotation';
import { generateProformaHTML } from '@/lib/pdf/proforma';
import { generateReceiptHTML } from '@/lib/pdf/receipt';

// In GET handler, select appropriate template:
let htmlContent;
switch (invoice.document_type) {
  case 'quotation':
    htmlContent = generateQuotationHTML({ invoice, lineItems, customer });
    break;
  case 'proforma':
    htmlContent = generateProformaHTML({ invoice, lineItems, customer });
    break;
  case 'receipt':
    htmlContent = generateReceiptHTML({ invoice, lineItems, customer });
    break;
  default:
    htmlContent = generateInvoiceHTML({ invoice, lineItems, customer });
}
```

**Estimated Time:** 4-6 hours  
**Files to Create:** 4 new files  
**Files to Modify:** 5 existing files

---

### 2. Multiple Email Addresses per Customer

**Status:** ✅ COMPLETED (December 15, 2025)  
**Priority:** HIGH  
**Requested By:** "some clients insists that we send to 2 or more emails"

#### Current State
- ✅ Customers table has email, email_2, email_3, email_4 fields
- ✅ Invoice/receipt email sending sends to all customer emails
- ✅ UI to manage all email addresses in customer forms
- ✅ Email validation with null handling for empty fields

#### Completed Features
- ✅ Additional email fields in customers table (migration 016)
- ✅ UI to manage multiple emails per customer (create/edit forms)
- ✅ Email sending logic to handle multiple recipients (bulk send)
- ✅ Validation for multiple email addresses (check constraints)

#### Implementation Steps

**Step 1: Update Database Schema**
```sql
-- File: supabase/migrations/015_add_multiple_emails.sql

-- Add additional email columns to customers table
ALTER TABLE customers
ADD COLUMN email_2 VARCHAR(255),
ADD COLUMN email_3 VARCHAR(255),
ADD COLUMN email_4 VARCHAR(255);

-- Add comments for clarity
COMMENT ON COLUMN customers.email IS 'Primary email address';
COMMENT ON COLUMN customers.email_2 IS 'Secondary email address (optional)';
COMMENT ON COLUMN customers.email_3 IS 'Tertiary email address (optional)';
COMMENT ON COLUMN customers.email_4 IS 'Fourth email address (optional)';
```

**Alternative Approach (More Flexible):**
```sql
-- File: supabase/migrations/015_add_multiple_emails_alternative.sql

-- Create a separate table for customer emails
CREATE TABLE customer_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  email_type VARCHAR(50) DEFAULT 'billing', -- 'billing', 'shipping', 'accounting', etc.
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_emails_customer ON customer_emails(customer_id);

-- Enable RLS
ALTER TABLE customer_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customer emails"
  ON customer_emails FOR SELECT
  USING (can_view_financials());
```

**Step 2: Update TypeScript Types**
```typescript
// File: src/types/database.ts

// Option 1: Simple approach
export interface Customer {
  // ... existing fields ...
  email_2?: string | null;
  email_3?: string | null;
  email_4?: string | null;
}

// Option 2: Relational approach
export interface CustomerEmail {
  id: string;
  customer_id: string;
  email: string;
  email_type: string;
  is_primary: boolean;
  created_at: string;
}

export interface CustomerWithEmails extends Customer {
  emails?: CustomerEmail[];
}
```

**Step 3: Update Customer Forms**
```tsx
// File: src/app/dashboard/customers/new/page.tsx
// File: src/app/dashboard/customers/[id]/edit/page.tsx

// Add email fields section:
<div className="space-y-4">
  <h3 className="font-medium text-gray-900">Email Addresses</h3>
  
  <div className="form-group">
    <label className="label">Primary Email</label>
    <input
      type="email"
      name="email"
      value={formData.email}
      onChange={handleChange}
      className="input"
      placeholder="primary@customer.com"
    />
  </div>

  <div className="form-group">
    <label className="label">Secondary Email (Optional)</label>
    <input
      type="email"
      name="email_2"
      value={formData.email_2}
      onChange={handleChange}
      className="input"
      placeholder="secondary@customer.com"
    />
  </div>

  <div className="form-group">
    <label className="label">Additional Email (Optional)</label>
    <input
      type="email"
      name="email_3"
      value={formData.email_3}
      onChange={handleChange}
      className="input"
      placeholder="accounting@customer.com"
    />
  </div>

  <div className="form-group">
    <label className="label">Fourth Email (Optional)</label>
    <input
      type="email"
      name="email_4"
      value={formData.email_4}
      onChange={handleChange}
      className="input"
      placeholder="manager@customer.com"
    />
  </div>
</div>
```

**Step 4: Update Email Sending Logic**
```typescript
// File: src/app/api/invoices/[id]/send/route.ts

// Collect all customer emails
const customerEmails = [
  invoice.customer.email,
  invoice.customer.email_2,
  invoice.customer.email_3,
  invoice.customer.email_4,
].filter(Boolean); // Remove null/undefined values

if (customerEmails.length === 0) {
  return NextResponse.json(
    { error: 'Customer does not have any email addresses' },
    { status: 400 }
  );
}

// Send to all emails
for (const email of customerEmails) {
  await sendInvoiceEmail({
    to: email,
    customerName: invoice.customer.name,
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date,
    totalAmount: Number(invoice.total_amount),
    balanceDue,
    paymentLink,
  });
}

return NextResponse.json({
  success: true,
  message: `Invoice sent to ${customerEmails.length} email address(es)`,
  recipients: customerEmails
});
```

**Step 5: Update Customer Display**
```tsx
// File: src/app/dashboard/customers/[id]/page.tsx

// Display all emails in contact section:
<div className="space-y-2">
  {customer.email && (
    <div className="flex items-center gap-2">
      <EnvelopeIcon className="w-4 h-4 text-gray-400" />
      <span className="text-sm font-medium">Primary:</span>
      <a href={`mailto:${customer.email}`} className="text-sm text-blue-600">
        {customer.email}
      </a>
    </div>
  )}
  {customer.email_2 && (
    <div className="flex items-center gap-2">
      <EnvelopeIcon className="w-4 h-4 text-gray-400" />
      <span className="text-sm font-medium">Secondary:</span>
      <a href={`mailto:${customer.email_2}`} className="text-sm text-blue-600">
        {customer.email_2}
      </a>
    </div>
  )}
  {customer.email_3 && (
    <div className="flex items-center gap-2">
      <EnvelopeIcon className="w-4 h-4 text-gray-400" />
      <span className="text-sm">
        <a href={`mailto:${customer.email_3}`} className="text-blue-600">
          {customer.email_3}
        </a>
      </span>
    </div>
  )}
  {customer.email_4 && (
    <div className="flex items-center gap-2">
      <EnvelopeIcon className="w-4 h-4 text-gray-400" />
      <span className="text-sm">
        <a href={`mailto:${customer.email_4}`} className="text-blue-600">
          {customer.email_4}
        </a>
      </span>
    </div>
  )}
</div>
```

**Estimated Time:** 2-3 hours  
**Files to Create:** 1 new migration  
**Files to Modify:** 6 existing files

---

### 3. Currency Selection (Including UGX)

**Status:** ✅ COMPLETED (December 15, 2025)  
**Priority:** MEDIUM  
**Current:** Multi-currency support implemented across all modules

#### Current State
- ✅ Customers have default currency field (USD, EUR, GBP, UGX)
- ✅ All document types support currency selection (invoices, receipts, quotations, proforma)
- ✅ Currency auto-selected from customer preference
- ✅ Proper currency formatting for each type (UGX uses 0 decimals)
- ✅ Exchange rate integration with API (exchangerate-api.com)
- ✅ Historical exchange rates stored for reporting
- ✅ Database functions for currency conversion
- ✅ All PDF templates use dynamic currency formatting

#### Completed Features
- ✅ UGX currency option across all modules
- ✅ Currency selection on all document types
- ✅ Customer default currency field in forms
- ✅ Proper currency formatting (UGX = 0 decimals, others = 2 decimals)
- ✅ Exchange rate API integration with historical tracking
- ✅ Currency conversion functions in database
- ✅ Auto-currency selection from customer on invoice creation
- ✅ Migration to set existing data currency to USD

#### Implementation Steps

**Step 1: Update Database Schema**
```sql
-- File: supabase/migrations/016_add_ugx_currency.sql

-- Add currency to customers table
ALTER TABLE customers
ADD COLUMN currency CHAR(3) DEFAULT 'USD';

-- Update invoices to support currency (if not already present)
ALTER TABLE invoices
ADD COLUMN currency CHAR(3) DEFAULT 'USD',
ADD COLUMN exchange_rate DECIMAL(12,6) DEFAULT 1.0;

-- Add common UGX exchange rates
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, source)
VALUES 
  ('UGX', 'USD', 0.00027, CURRENT_DATE, 'manual'),
  ('USD', 'UGX', 3700.00, CURRENT_DATE, 'manual')
ON CONFLICT (from_currency, to_currency, effective_date) DO NOTHING;
```

**Step 2: Update Currency Options Everywhere**
```tsx
// File: src/components/ui/currency-select.tsx (NEW FILE)

export function CurrencySelect({ 
  value, 
  onChange, 
  name 
}: { 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  name?: string;
}) {
  return (
    <select 
      value={value} 
      onChange={onChange}
      name={name}
      className="input"
    >
      <option value="USD">$ - US Dollar (USD)</option>
      <option value="EUR">€ - Euro (EUR)</option>
      <option value="GBP">£ - British Pound (GBP)</option>
      <option value="UGX">USh - Ugandan Shilling (UGX)</option>
    </select>
  );
}
```

**Step 3: Update Invoice Creation**
```tsx
// File: src/app/dashboard/invoices/new/page.tsx

// Add currency selector in form:
<div className="form-group">
  <label className="label">Currency</label>
  <CurrencySelect
    value={watchCurrency || 'USD'}
    onChange={(e) => setValue('currency', e.target.value)}
  />
</div>
```

**Step 4: Update Formatting Utilities**
```typescript
// File: src/lib/utils.ts

export function formatCurrency(
  amount: number, 
  currencyCode: string = 'USD'
): string {
  const currencySymbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'UGX': 'USh'
  };

  const decimals = currencyCode === 'UGX' ? 0 : 2; // UGX doesn't use decimals
  
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return `${currencySymbols[currencyCode] || currencyCode} ${formatted}`;
}
```

**Step 5: Update Customer Forms**
```tsx
// File: src/app/dashboard/customers/new/page.tsx
// File: src/app/dashboard/customers/[id]/edit/page.tsx

// Add currency field:
<div className="form-group">
  <label className="label">Preferred Currency</label>
  <CurrencySelect
    value={formData.currency || 'USD'}
    onChange={handleChange}
    name="currency"
  />
  <p className="text-sm text-gray-500 mt-1">
    Default currency for invoices to this customer
  </p>
</div>
```

**Step 6: Update Invoice PDF Templates**
```typescript
// File: src/lib/pdf/invoice.ts

// Update formatCurrency calls to use invoice currency:
const formatCurrency = (amount: number) => {
  const currencySymbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'UGX': 'USh'
  };
  
  const currency = invoice.currency || 'USD';
  const decimals = currency === 'UGX' ? 0 : 2;
  
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return `${currencySymbols[currency] || currency} ${formatted}`;
};
```

**Estimated Time:** 3-4 hours  
**Files to Create:** 2 new files  
**Files to Modify:** 10+ existing files

---

### 4. Director Name and Signature Integration

**Status:** ⚠️ NAME HARDCODED, SIGNATURE MISSING  
**Priority:** MEDIUM  
**Current:** "N.Maureen" hardcoded in multiple places

#### Current State
- Director name "N.Maureen" is hardcoded in:
  - Invoice PDFs
  - Bill PDFs
  - Report headers
  - Customer statements
- No director signature field or image upload
- Company settings table exists but lacks director fields

#### What's Missing
- [ ] `director_name` field in company_settings
- [ ] `director_signature_url` field in company_settings
- [ ] Signature image upload functionality
- [ ] Replace all hardcoded "N.Maureen" with database value
- [ ] Display signature on documents

#### Implementation Steps

**Step 1: Update Database Schema**
```sql
-- File: supabase/migrations/017_add_director_fields.sql

-- Add director fields to company_settings
ALTER TABLE company_settings
ADD COLUMN director_name VARCHAR(255) DEFAULT 'N.Maureen',
ADD COLUMN director_title VARCHAR(100) DEFAULT 'Director',
ADD COLUMN director_signature_url VARCHAR(500);

COMMENT ON COLUMN company_settings.director_name IS 'Full name of company director';
COMMENT ON COLUMN company_settings.director_title IS 'Title of director (Director, CEO, Managing Director, etc.)';
COMMENT ON COLUMN company_settings.director_signature_url IS 'URL to director signature image';
```

**Step 2: Update Company Settings Type**
```typescript
// File: src/types/database.ts

export interface CompanySettings {
  // ... existing fields ...
  director_name?: string | null;
  director_title?: string | null;
  director_signature_url?: string | null;
}
```

**Step 3: Add to Settings Form**
```tsx
// File: src/app/dashboard/settings/page.tsx

// Add new section in Company tab:
<div className="space-y-4">
  <h3 className="font-medium text-gray-900">Director Information</h3>
  
  <div className="form-group">
    <label className="label">Director Name</label>
    <input
      type="text"
      {...companyForm.register('director_name')}
      className="input"
      placeholder="N.Maureen"
    />
  </div>

  <div className="form-group">
    <label className="label">Director Title</label>
    <input
      type="text"
      {...companyForm.register('director_title')}
      className="input"
      placeholder="Director"
    />
  </div>

  <div className="form-group">
    <label className="label">Director Signature</label>
    <div className="space-y-2">
      {settings?.director_signature_url ? (
        <div className="flex items-center gap-4">
          <img 
            src={settings.director_signature_url} 
            alt="Signature" 
            className="h-16 border border-gray-200 rounded"
          />
          <button 
            type="button" 
            onClick={() => companyForm.setValue('director_signature_url', null)}
            className="btn-secondary text-sm"
          >
            Remove
          </button>
        </div>
      ) : (
        <input
          type="file"
          accept="image/*"
          onChange={handleSignatureUpload}
          className="input"
        />
      )}
      <p className="text-sm text-gray-500">
        Upload a PNG or JPG image of the director's signature (max 2MB)
      </p>
    </div>
  </div>
</div>
```

**Step 4: Add Signature Upload Handler**
```typescript
// File: src/app/dashboard/settings/page.tsx

const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Validate file size (2MB max)
  if (file.size > 2 * 1024 * 1024) {
    toast.error('File size must be less than 2MB');
    return;
  }

  try {
    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `signature-${Date.now()}.${fileExt}`;
    const filePath = `signatures/${fileName}`;

    const { data, error } = await supabase.storage
      .from('company-files')
      .upload(filePath, file);

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('company-files')
      .getPublicUrl(filePath);

    // Update form
    companyForm.setValue('director_signature_url', publicUrl);
    toast.success('Signature uploaded successfully');
  } catch (error) {
    console.error('Upload error:', error);
    toast.error('Failed to upload signature');
  }
};
```

**Step 5: Create Storage Bucket**
```sql
-- File: supabase/migrations/017_add_director_fields.sql

-- Create storage bucket for company files
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-files', 'company-files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies
CREATE POLICY "Authenticated users can upload company files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-files');

CREATE POLICY "Public can view company files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'company-files');
```

**Step 6: Update Company Settings Utility**
```typescript
// File: src/lib/company-settings.ts

// Default settings should include director info
function getDefaultSettings(): CompanySettings {
  return {
    // ... existing defaults ...
    director_name: 'N.Maureen',
    director_title: 'Director',
    director_signature_url: null,
  };
}
```

**Step 7: Update All PDF Templates**
```typescript
// File: src/app/api/reports/depreciation/export/route.ts
// File: src/app/api/invoices/[id]/pdf/route.ts
// File: src/lib/pdf/invoice.ts
// File: src/lib/pdf/bill.ts
// And all other report exports...

// Replace hardcoded:
<div class="address">Director: N.Maureen</div>

// With:
<div class="address">
  ${companySettings.director_title || 'Director'}: ${companySettings.director_name || 'N.Maureen'}
</div>

// Add signature if available:
${companySettings.director_signature_url ? `
  <div class="signature-section" style="margin-top: 40px;">
    <p style="font-size: 12px; color: #6b7280; margin-bottom: 10px;">
      Authorized Signature:
    </p>
    <img 
      src="${companySettings.director_signature_url}" 
      alt="Signature" 
      style="height: 40px; margin-bottom: 5px;"
    />
    <div style="border-top: 1px solid #000; width: 200px; margin-bottom: 5px;"></div>
    <p style="font-size: 11px; color: #6b7280;">
      ${companySettings.director_name || 'N.Maureen'}, ${companySettings.director_title || 'Director'}
    </p>
  </div>
` : ''}
```

**Estimated Time:** 3-4 hours  
**Files to Create:** 1 migration, signature upload bucket  
**Files to Modify:** 15+ PDF templates and reports

---

### 5. Auto-Send Copy to Firm Email

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** MEDIUM  
**Requested By:** "automatically send everything generated a copy to the firm email"

#### Current State
- Email system only sends to customer
- No BCC or copy to company email
- No email archive functionality
- Company email not in settings

#### What's Missing
- [ ] Firm/company email field in settings
- [ ] BCC functionality on all outgoing emails
- [ ] Email logging/archive system
- [ ] Settings to enable/disable auto-copy

#### Implementation Steps

**Step 1: Update Database Schema**
```sql
-- File: supabase/migrations/018_add_firm_email.sql

-- Add firm email to company_settings
ALTER TABLE company_settings
ADD COLUMN firm_email VARCHAR(255),
ADD COLUMN auto_bcc_firm_email BOOLEAN DEFAULT true;

COMMENT ON COLUMN company_settings.firm_email IS 'Company email address to receive copies of all outgoing emails';
COMMENT ON COLUMN company_settings.auto_bcc_firm_email IS 'Automatically BCC firm email on all outgoing emails';

-- Create email log table for tracking
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_type VARCHAR(50) NOT NULL, -- 'invoice', 'statement', 'receipt', etc.
  recipient_email VARCHAR(255) NOT NULL,
  cc_emails TEXT[], -- Array of CC emails
  bcc_emails TEXT[], -- Array of BCC emails
  subject VARCHAR(500),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  related_document_type VARCHAR(50), -- 'invoice', 'bill', etc.
  related_document_id UUID,
  sent_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX idx_email_logs_document ON email_logs(related_document_type, related_document_id);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email logs"
  ON email_logs FOR SELECT
  USING (can_view_financials());
```

**Step 2: Update Company Settings Type**
```typescript
// File: src/types/database.ts

export interface CompanySettings {
  // ... existing fields ...
  firm_email?: string | null;
  auto_bcc_firm_email?: boolean;
}

export interface EmailLog {
  id: string;
  email_type: string;
  recipient_email: string;
  cc_emails?: string[];
  bcc_emails?: string[];
  subject?: string;
  sent_at: string;
  status: 'sent' | 'failed' | 'bounced';
  error_message?: string;
  related_document_type?: string;
  related_document_id?: string;
  sent_by?: string;
  created_at: string;
}
```

**Step 3: Add to Settings Form**
```tsx
// File: src/app/dashboard/settings/page.tsx

// Add in Company tab:
<div className="space-y-4">
  <h3 className="font-medium text-gray-900">Email Settings</h3>
  
  <div className="form-group">
    <label className="label">Firm Email Address</label>
    <input
      type="email"
      {...companyForm.register('firm_email')}
      className="input"
      placeholder="info@sceneside.com"
    />
    <p className="text-sm text-gray-500 mt-1">
      This email will receive copies of all outgoing documents
    </p>
  </div>

  <div className="form-group">
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        {...companyForm.register('auto_bcc_firm_email')}
        className="w-4 h-4 rounded border-gray-300"
      />
      <span className="text-sm text-gray-700">
        Automatically BCC firm email on all outgoing emails
      </span>
    </label>
  </div>
</div>
```

**Step 4: Update Email Sending Utility**
```typescript
// File: src/lib/email/resend.ts

// Create wrapper function for all emails
async function sendEmailWithLogging({
  to,
  subject,
  html,
  emailType,
  relatedDocumentType,
  relatedDocumentId,
  userId
}: {
  to: string | string[];
  subject: string;
  html: string;
  emailType: string;
  relatedDocumentType?: string;
  relatedDocumentId?: string;
  userId?: string;
}) {
  try {
    // Get company settings
    const { getCompanySettings } = await import('@/lib/company-settings');
    const settings = await getCompanySettings();

    const recipients = Array.isArray(to) ? to : [to];
    const bccEmails: string[] = [];

    // Add firm email to BCC if enabled
    if (settings.auto_bcc_firm_email && settings.firm_email) {
      bccEmails.push(settings.firm_email);
    }

    // Send email
    const resend = await getResendClient();
    const { data, error } = await resend.emails.send({
      from: 'Sceneside L.L.C <noreply@sceneside.com>',
      to: recipients,
      bcc: bccEmails.length > 0 ? bccEmails : undefined,
      subject,
      html,
    });

    if (error) {
      // Log failure
      await logEmail({
        emailType,
        recipientEmail: recipients[0],
        bccEmails,
        subject,
        status: 'failed',
        errorMessage: error.message,
        relatedDocumentType,
        relatedDocumentId,
        sentBy: userId,
      });
      throw error;
    }

    // Log success
    await logEmail({
      emailType,
      recipientEmail: recipients[0],
      bccEmails,
      subject,
      status: 'sent',
      relatedDocumentType,
      relatedDocumentId,
      sentBy: userId,
    });

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

async function logEmail(params: {
  emailType: string;
  recipientEmail: string;
  bccEmails?: string[];
  subject?: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
  relatedDocumentType?: string;
  relatedDocumentId?: string;
  sentBy?: string;
}) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.from('email_logs').insert({
    email_type: params.emailType,
    recipient_email: params.recipientEmail,
    bcc_emails: params.bccEmails,
    subject: params.subject,
    status: params.status,
    error_message: params.errorMessage,
    related_document_type: params.relatedDocumentType,
    related_document_id: params.relatedDocumentId,
    sent_by: params.sentBy,
  });
}
```

**Step 5: Update Invoice Send API**
```typescript
// File: src/app/api/invoices/[id]/send/route.ts

// Replace direct sendInvoiceEmail call with:
const { data: { user } } = await supabase.auth.getUser();

await sendEmailWithLogging({
  to: customerEmails,
  subject: `Invoice ${invoice.invoice_number} from Sceneside L.L.C`,
  html: invoiceEmailHTML,
  emailType: 'invoice',
  relatedDocumentType: 'invoice',
  relatedDocumentId: invoiceId,
  userId: user?.id,
});
```

**Step 6: Create Email Logs Viewer (Optional)**
```tsx
// File: src/app/dashboard/settings/email-logs/page.tsx (NEW FILE)

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('email_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);
    
    setLogs(data || []);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Email Logs</h1>
      
      <table className="w-full">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Recipient</th>
            <th>Subject</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{formatDate(log.sent_at)}</td>
              <td>{log.email_type}</td>
              <td>{log.recipient_email}</td>
              <td>{log.subject}</td>
              <td>
                <span className={`badge ${log.status === 'sent' ? 'badge-success' : 'badge-error'}`}>
                  {log.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Estimated Time:** 4-5 hours  
**Files to Create:** 3 new files  
**Files to Modify:** 8 existing files

---

## 📊 SUMMARY

### Implementation Priority

| Feature | Status | Priority | Estimated Time | Complexity |
|---------|--------|----------|----------------|------------|
| Multiple Emails | ❌ Missing | HIGH | 2-3 hours | Low |
| Currency (UGX) | ⚠️ Partial | MEDIUM | 3-4 hours | Medium |
| Director Fields | ⚠️ Partial | MEDIUM | 3-4 hours | Medium |
| Firm Email BCC | ❌ Missing | MEDIUM | 4-5 hours | Medium |
| Document Types | ❌ Missing | HIGH | 4-6 hours | High |

### Total Estimated Time
**16-22 hours** for complete implementation of all missing features

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

1. **Multiple Email Addresses** (2-3 hours)
   - Most requested feature
   - Straightforward implementation
   - Immediate business value

2. **Currency Support (UGX)** (3-4 hours)
   - Builds on existing partial implementation
   - Important for international operations
   - Affects invoices and reports

3. **Director Name & Signature** (3-4 hours)
   - Completes existing company settings
   - Enhances document professionalism
   - Removes hardcoded values

4. **Firm Email BCC** (4-5 hours)
   - Enhances email tracking
   - Provides audit trail
   - Automatic backup of communications

5. **Document Types** (4-6 hours)
   - Most complex feature
   - Requires multiple new templates
   - Builds on all previous features

---

## 📝 NOTES

- All migrations should be tested in development first
- Backup database before running migrations
- Update TypeScript types after database changes
- Test email functionality in staging environment
- Consider adding feature flags for gradual rollout
- Document all new features in user guide

---

**Ready to implement?** Start with Feature #1 (Multiple Emails) and work through the list sequentially for best results.
