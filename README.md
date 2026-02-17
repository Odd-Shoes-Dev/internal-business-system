# Business Management Platform

A comprehensive multi-tenant business management platform featuring double-entry bookkeeping, invoicing, industry-specific operations modules, inventory management, and more. Built for tour operators, cafes, retail businesses, and other service-based companies.

## 🌟 Platform Overview

**Multi-Tenant SaaS Platform** - Each company gets their own isolated workspace with:
- Complete data isolation via Row Level Security (RLS)
- Customizable branding (logo, colors, company details)
- Modular feature activation based on industry needs
- Subscription-based pricing model
- Scalable architecture supporting 100+ companies

## 🚀 Features

### Core Platform (All Companies)

1. **Financial Management**
   - Double-entry bookkeeping with chart of accounts
   - Multi-currency support (USD, EUR, GBP, UGX, etc.)
   - Automated journal entries
   - Period locking and fiscal year management
   - Audit trails and activity logging

2. **General Ledger**
   - Double-entry bookkeeping
   - Chart of accounts with hierarchical structure
   - Journal entries with auto-balancing
   - Trial balance and account reconciliation

3. **Revenue & Sales (AR)**
   - Customer management
   - Invoice creation with line items
   - Multiple payment methods
   - Stripe integration for online payments
   - Invoice PDF generation
   - Email invoices to customers
   - A/R aging reports

4. **Expenses & Payables (AP)**
   - Vendor management
   - Bill tracking and payment
   - Expense categorization
   - A/P aging reports

5. **Inventory Management**
   - Product/service catalog
   - Stock tracking with FIFO valuation
   - Low stock alerts
   - Inventory valuation reports

6. **Fixed Assets**
   - Asset register
   - Depreciation tracking (straight-line, declining balance, sum-of-years)
   - Asset disposal management

7. **Cash & Bank Management**
   - Multiple bank accounts
   - Transaction tracking
   - Bank reconciliation

8. **Financial Reporting**
   - Profit & Loss Statement
   - Balance Sheet
   - Cash Flow Statement
   - Trial Balance
   - Customer/Vendor statements
   - Sales by customer/product reports

9. **User Management**
   - Role-based access (Admin, Accountant, Operations, Sales, Guide, Viewer)
   - Multi-company user support
   - Activity logging
   - Secure authentication via Supabase
   - Invitation system

---

### Industry-Specific Modules

#### 🌍 Tour Operations Module
- Tour package management with pricing & itineraries
- Booking system with capacity tracking
- Customer booking management
- Seasonal pricing
- Destination management

#### 🚗 Fleet Management Module
- Vehicle registry and tracking
- Maintenance scheduling
- Fuel monitoring
- Driver management
- Vehicle assignment to tours/bookings

#### 🏨 Hotel Management Module
- Hotel directory
- Room inventory and pricing
- Reservation management
- Occupancy tracking
- Housekeeping coordination

#### 📦 Inventory & Assets Module
- Product inventory with stock tracking
- FIFO valuation
- Fixed asset management
- Depreciation tracking (straight-line, declining balance)
- Multi-location warehouse support
- Purchase orders

#### 💰 Payroll Processing Module
- Automated payroll calculations
- Tax and deductions (PAYE, NSSF)
- Payslip generation and distribution
- Salary advances and loans
- Bank payment file generation
- Payroll compliance reporting

#### ☕ Cafe & Restaurant Module
- Sales recording and tracking
- Daily/Monthly revenue reports
- Food & beverage sales
- Catering revenue tracking
- Expense breakdown analysis
- Profit margin calculations
- Cash & card payment tracking

#### 🏪 Retail & Wholesale Module (Coming Soon)
- Point of Sale (POS) interface
- Table management
- Kitchen order system
- Menu management with modifiers
- Split bills and tips tracking
- Daily Z-reports

#### 🏪 Retail & Wholesale Module (Coming Soon)
- Advanced inventory with multi-location support
- Purchase orders and supplier management
- Sales orders
- Price tiers
- Barcode scanning

#### 🛡️ Security Operations Module (Coming Soon)
- Guard scheduling and site management
- Patrol tracking
- Incident reporting
- Client billing
- GPS tracking

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL (Supabase) - Multi-tenant with RLS
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **UI Components**: Headless UI, Heroicons
- **Payments**: Stripe, Flutterwave (Mobile Money)
- **Email**: Resend
- **State Management**: Zustand, React Query
- **Forms**: React Hook Form + Zod
- **Charts**: Chart.js / React-Chartjs-2
- **PDF Generation**: Custom library
- **Decimal Math**: Decimal.js (for financial accuracy)

## 📁 Project Structure

```
tour-system/
├── public/
│   └── assets/                 # Static assets
├── src/
│   ├── app/
│   │   ├── api/                # API routes (multi-tenant aware)
│   │   ├── dashboard/          # Dashboard pages
│   │   │   ├── bookings/       # Tour module
│   │   │   ├── tours/          # Tour module
│   │   │   ├── hotels/         # Tour module
│   │   │   ├── fleet/          # Tour module
│   │   │   ├── cafe/           # Cafe module
│   │   │   ├── invoices/       # Core
│   │   │   ├── expenses/       # Core
│   │   │   ├── customers/      # Core
│   │   │   ├── reports/        # Core
│   │   │   └── settings/       # Company settings
│   │   ├── signup/             # Company registration
│   │   ├── onboarding/         # First-time setup wizard
│   │   ├── login/              # Authentication
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   └── layout/             # Layout components
│   ├── lib/
│   │   ├── supabase/           # Supabase client & helpers
│   │   ├── accounting/         # Accounting logic
│   │   ├── stripe.ts           # Payment integration
│   │   ├── email/              # Email templates
│   │   ├── pdf/                # PDF generation
│   │   ├── currency.ts         # Multi-currency handling
│   │   └── company-settings.ts # Company configuration
│   ├── contexts/               # React contexts (company, modules)
│   └── types/                  # TypeScript types
├── docs/
│   ├── platform-transformation/ # Platform migration guides
│   ├── USER_GUIDE.md
│   └── PRODUCTION_READY_STATUS.md
├── supabase/
│   └─tour-systemrations/             # Database migrations (35+)
└── tailwind.config.js
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account (for payments)
- Resend account (for emails)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Breco
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your credentials:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # Stripe
   STRIPE_SECRET_KEY=sk_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
   STRIPE_WEBHOOK_SECRET=whsec_...

   # Resend (Email)
   RESEND_API_KEY=re_...

   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Set up the database**
   
   Run all migrations in order from `supabase/migrations/`:
   - `001_initial_schema.sql` - Core tables
   - `002_rls_policies.sql` - Row Level Security
   - `003_seed_data.sql` - Initial chart of accounts
   - `004-034_*.sql` - Feature migrations
   - `035_multi_tenant_core.sql` - Multi-tenant tables ⚠️ CRITICAL
   - `036_add_company_id.sql` - Add company_id to all tables ⚠️ CRITICAL
   - `037_enable_rls.sql` - Enable RLS policies ⚠️ CRITICAL
   
   See `docs/platform-transformation/03_TECHNICAL_MIGRATION_GUIDE.md` for details.

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open the application**
   Multi-Tenant Core Tables

| Table | Description |
|-------|-------------|
| `companies` | Company records (tenants) |
| `user_companies` | User-company relationships |
| `company_modules` | Enabled modules per company |
| `company_settings` | Company-specific configuration |

### Core Tables (All have `company_id`)

| Table | Description |
|-------|-------------|
| `user_profiles` | User accounts with roles |
| `chart_of_accounts` | Account hierarchy (per company)

| Table | Description |
|-------|-------------|
| `user_profiles` | User accounts with roles |
| `chart_of_accounts` | Account hierarchy |
| `journal_entries` | Transaction headers |
| `journal_entry_lines` | Transaction details |
| `fiscal_periods` | Accounting periods |

### Revenue/AR

| Table | Description |
|-------|-------------|
| `customers` | Customer records |
| `invoices` | Sales invoices |
| `invoice_line_items` | Invoice details |
| `invoice_payments` | Payment records |

### Expenses/AP

| Table | Description |
|-------|-------------|
| `vendors` | Vendor records |
| `bills` | Vendor bills |
| `bill_line_items` | Bill details |
| `bill_payments` | Payment records |
| `expenses` | Direct expenses |

### Inventory

| Table | Description |
|-------|-------------|
| `inventory_items` | Products/services |
| `inventory_transactions` | Stock movements |

### Assets

| Table | Description |
|-------|-------------|

### Tour Module Tables

| **Multi-Tenant Isolation**: Each company's data is completely isolated
- **Row Level Security (RLS)**: Enforced at database level on all tables
- **Role-based Access Control**: Admin, Accountant, Operations, Sales, etc.
- **Secure API Routes**: Company membership validation on every request
- **Encrypted Payments**: Stripe & Flutterwave integration
- **Audit Logging**: All critical actions are logged
- **Session Management**: Secure authentication via Supabase Authicing |
| `destinations` | Tour destinations |
| `hotels` | Hotel directory |
| `fleet` | Vehicle fleet |
| `guides` | Tour guides |

**Note:** All tables include `company_id` for multi-tenant isolation.
| `fixed_assets` | Asset register |
| `asset_depreciation` | Depreciation records |

### Banking

| Table | Description |
|-------|-------------|
| `bank_accounts` | Bank/cash accounts |
| `bank_transactions` | Bank movements |

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- Role-based access control
- Secure API routes with session validation
- Encrypted payment processing via Stripe

## 💳 Payment Integration

### Stripe Setup

1. CreCustomization

Each company can configure:
- **Branding**: Logo, company name, colors
- **Localization**: Currency, date format, language
- **Tax Settings**: VAT rates, tax ID
- **Modules**: Enable/disable features based on needs
- **Invoice Templates**: Customizable PDF layouts
- **Email Templates**: Branded email communications

## 🌍 Multi-Currency Support

- **Supported Currencies**: UGX, USD, EUR, GBP, KES, TZS, and more
- **Exchange Rates**: Auto-update or manual entry
- **Multi-Currency Transactions**: Automatic conversion in reports
- **Base Currency**: Set per company
4. Update email sender addresses in `src/lib/email/resend.ts`

## 🎨 Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Navy | `#1e3a5f` | Primary, headers |
| Green | `#52b53b` | Accent, success states |
| Teal | `#0d9488` | Gradients, secondary |

## 📝 Tax Configuration

- **Country**: Uganda
- **VAT Rate**: 18%
- Configurable per invoice (GAAP compliant)
- **Inventory Valuation**: FIFO (First In, First Out)
- **Depreciation Methods**:
  - Straight Line
  - Declining Balance
  - Sum of Years Digits
- **Period Locking**: Prevent changes to closed periods
- **Audit Trail**: Complete transaction history

## 📈 Platform Transformation

This system is actively being transformed into a full multi-tenant platform. See detailed roadmap in `docs/platform-transformation/`:

- **[00_CRITICAL_2DAY_LAUNCH.md](docs/platform-transformation/00_CRITICAL_2DAY_LAUNCH.md)** - Immediate launch plan
- **[01_30DAY_REFINEMENT.md](docs/platform-transformation/01_30DAY_REFINEMENT.md)** - Post-launch improvements
- **[02_90DAY_FULL_PLATFORM.md](docs/platform-transformation/02_90DAY_FULL_PLATFORM.md)** - Complete platform vision
- **[03_TECHNICAL_MIGRATION_GUIDE.md](docs/platform-transformation/03_TECHNICAL_MIGRATION_GUIDE.md)** - Developer guide
- **[04_PRICING_MODEL.md](docs/platform-transformation/04_PRICING_MODEL.md)** - Revenue strategy

## 💼 Business Model

**SaaS Subscription Platform**

- **Setup Fee**: $200-500 (one-time)
- **Monthly Plans**: $50-250/month based on features
- **Module Add-ons**: $30-50/month per module
- **Target Market**: African SMEs (tour operators, cafes, retail, services)
- **Scale Target**: 100-500 companies in Year 1

## 📄 License

Proprietary - All Rights Reserved © 2026

## 🤝 Support & Contact

For technical support, feature requests, or business inquiries:
- **Email**: support@yourdomain.com
- **Documentation**: See `docs/` folder
- **Roadmap**: `docs/platform-transformation/`

---

**Version**: 2.0.0 (Multi-Tenant Platform)  
**Status**: Production Ready (Tour Module) | Beta (Multi-Tenant)  
**Last Updated**: January 24, 2026
For technical support or questions, contact the development team.

---

Built with ❤️ for Breco Safaris Ltd
#