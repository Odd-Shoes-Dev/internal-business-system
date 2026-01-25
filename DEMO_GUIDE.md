# BlueOx Management System - Demo Guide

**Welcome to BlueOx!** This guide will help you explore and understand the powerful features of your new business management platform.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Company Setup](#company-setup)
4. [Finance Module](#finance-module)
5. [Relationships Module](#relationships-module)
6. [Accounting & Reports](#accounting--reports)
7. [Optional Modules](#optional-modules)
8. [User Management](#user-management)
9. [Best Practices](#best-practices)
10. [Support & Resources](#support--resources)

---

## Getting Started

### First Login

When you first log in, you'll see:
- **Company Dashboard**: Overview of your business metrics
- **Navigation Sidebar**: Access to all modules
- **User Menu**: Profile settings and logout

### Initial Setup Checklist

✅ Complete your company information  
✅ Upload your company logo  
✅ Set up your chart of accounts  
✅ Add your first customers and vendors  
✅ Configure financial settings  
✅ Enable required modules  

---

## Dashboard Overview

The dashboard provides a real-time snapshot of your business:

### Key Metrics Cards
- **Total Revenue**: Current period income
- **Accounts Receivable**: Outstanding customer balances
- **Accounts Payable**: Outstanding vendor bills
- **Net Profit**: Profitability overview

### Quick Actions
- Create new invoices
- Record expenses
- Add customers/vendors
- Generate reports

### Recent Activity
- Latest transactions
- Pending approvals
- Upcoming due dates

---

## Company Setup

### 1. Company Information

**Settings > Company**

Configure your business details:

```
Company Name: Your Business Ltd
Email: contact@yourbusiness.com
Phone: +1 (555) 123-4567
Address: Full business address
Website: https://www.yourbusiness.com
```

**Tax Information:**
- Tax ID / VAT Number
- Registration Number

### 2. Upload Company Logo

**Settings > Company > Company Logo**

1. Click **Upload Logo**
2. Select square image (PNG/JPG, max 2MB)
3. Logo appears immediately in:
   - Sidebar header
   - Reports and invoices
   - Email templates

### 3. Financial Settings

**Settings > Financial**

- **Fiscal Year Start**: Select your fiscal year beginning month
- **Default Currency**: Primary operating currency
- **Payment Terms**: Default number of days (e.g., Net 30)
- **Tax Rate**: Default sales tax percentage

### 4. Module Activation

**Settings > Modules** (if available)

Enable modules based on your business needs:
- ✅ **Accounting** (Core - Always enabled)
- ✅ **Invoicing** (Core - Always enabled)
- ✅ **Expenses** (Core - Always enabled)
- ⬜ **Cafe Operations** (For food service businesses)
- ⬜ **Tour Operations** (For travel/tourism businesses)
- ⬜ **Payroll** (HR & employee management)
- ⬜ **Inventory** (Stock & asset tracking)

---

## Finance Module

### Invoices

**Creating an Invoice:**

1. Navigate to **Finance > Invoices**
2. Click **+ New Invoice**
3. Fill in details:
   - Select Customer
   - Invoice Date & Due Date
   - Add Line Items (description, quantity, rate)
   - Apply taxes if applicable
4. Click **Save Invoice**
5. Choose action:
   - **Send via Email** (automatic)
   - **Print PDF**
   - **Record Payment**

**Invoice Statuses:**
- 🔵 **Draft**: Not sent to customer
- 🟡 **Sent**: Awaiting payment
- 🟢 **Paid**: Fully paid
- 🔴 **Overdue**: Past due date
- 🟠 **Partially Paid**: Partial payment received
- ⚫ **Cancelled**: Voided invoice

### Receipts

**Recording Payments:**

1. Go to **Finance > Receipts**
2. Click **+ New Receipt**
3. Select:
   - Customer
   - Payment Date
   - Amount Received
   - Payment Method
4. Link to invoice(s)
5. Save & Generate Receipt

### Bills (Payables)

**Managing Vendor Bills:**

1. Navigate to **Finance > Bills**
2. Click **+ New Bill**
3. Enter:
   - Vendor
   - Bill Date & Due Date
   - Line items
   - Total amount
4. Track payment status
5. Record payment when paid

### Expenses

**Recording Business Expenses:**

1. Go to **Finance > Expenses**
2. Click **+ New Expense**
3. Fill in:
   - Expense Date
   - Vendor/Payee
   - Category (account)
   - Amount
   - Description
   - Payment Method
4. Upload receipt image (optional)
5. Submit for approval (if workflow enabled)

**Expense Categories:**
- Office Supplies
- Travel & Transportation
- Utilities
- Marketing & Advertising
- Professional Services
- Rent & Facilities

### Bank & Cash

**Cash Flow Management:**

1. Navigate to **Finance > Bank & Cash**
2. View all bank accounts
3. Track:
   - Current balances
   - Recent transactions
   - Cash flow trends
4. Reconcile accounts monthly

---

## Relationships Module

### Customers

**Adding a Customer:**

1. Go to **Relationships > Customers**
2. Click **+ New Customer**
3. Enter details:
   - Customer Name
   - Email & Phone
   - Billing Address
   - Payment Terms
   - Credit Limit (optional)
4. Save

**Customer Management:**
- View all invoices
- Check account balance
- Generate statements
- Track payment history
- Set credit limits

### Vendors

**Adding a Vendor:**

1. Navigate to **Relationships > Vendors**
2. Click **+ New Vendor**
3. Fill in:
   - Vendor Name
   - Contact Information
   - Payment Terms
   - Tax ID
4. Save

**Vendor Features:**
- Track bills and payments
- View purchase history
- Generate vendor statements
- Monitor outstanding balances

---

## Accounting & Reports

### General Ledger

**Settings > Accounting > General Ledger**

View all financial transactions in chronological order:
- Filter by date range
- Filter by account
- Search transactions
- Export to Excel/PDF

### Chart of Accounts

**Settings > Accounting > Chart of Accounts**

The backbone of your accounting system:

**Account Types:**
1. **Assets** (1000-1999)
   - Cash & Bank Accounts
   - Accounts Receivable
   - Inventory
   - Fixed Assets

2. **Liabilities** (2000-2999)
   - Accounts Payable
   - Loans
   - Credit Cards

3. **Equity** (3000-3999)
   - Owner's Equity
   - Retained Earnings

4. **Revenue** (4000-4999)
   - Sales Income
   - Service Revenue
   - Other Income

5. **Expenses** (5000-9999)
   - Cost of Goods Sold
   - Operating Expenses
   - Administrative Costs

**Adding an Account:**
1. Click **+ New Account**
2. Select account type
3. Enter account name and code
4. Set parent account (if sub-account)
5. Save

### Financial Reports

**Navigate to Settings > Accounting > Reports**

#### Standard Reports Available:

**1. Profit & Loss Statement**
- Shows revenue and expenses
- Calculates net income
- Compare periods
- Export PDF/Excel

**2. Balance Sheet**
- Assets, Liabilities, Equity
- Financial position snapshot
- As-of any date

**3. Cash Flow Statement**
- Operating activities
- Investing activities
- Financing activities
- Net cash change

**4. Trial Balance**
- All account balances
- Debits vs Credits verification
- Pre-financial statement check

**5. Accounts Receivable Aging**
- Outstanding invoices by age
- Current, 30, 60, 90+ days
- Collection priorities

**6. Accounts Payable Aging**
- Outstanding bills by age
- Payment priorities
- Cash planning

**7. General Ledger Report**
- All transactions by account
- Date range filtering
- Detailed audit trail

**8. Customer/Vendor Statements**
- Account activity summary
- Outstanding balances
- Send via email

---

## Optional Modules

### Tour Operations (Tourism/Travel)

**Enable if you operate a tour/travel business**

**Features:**
- Tour Package Management
- Booking System
- Hotel Partnerships
- Fleet Management
- Itinerary Planning

**Quick Start:**
1. Go to **Tour Operations > Tour Packages**
2. Create tour packages with pricing
3. Add hotels and accommodations
4. Manage bookings
5. Track capacity and availability

### Cafe Operations (Food Service)

**Enable if you run a restaurant/cafe**

**Features:**
- Menu Management
- Order Processing
- Table Management
- Kitchen Orders
- POS Integration

### Payroll (HR Management)

**Enable for employee management**

**Features:**
- Employee Records
- Salary/Wage Processing
- Tax Calculations
- Payslip Generation
- Leave Management

**Quick Start:**
1. Add employees
2. Set salary structures
3. Process monthly payroll
4. Generate payslips
5. Record journal entries

### Inventory (Stock Management)

**Enable for product businesses**

**Features:**
- Inventory Tracking
- Stock Levels
- Reorder Alerts
- Fixed Assets Register
- Depreciation Tracking

---

## User Management

### Adding Team Members

**Settings > Users**

1. Click **+ Invite User**
2. Enter email address
3. Select role:
   - **Admin**: Full access
   - **Manager**: Department access
   - **Accountant**: Finance access
   - **Viewer**: Read-only access
4. Send invitation
5. User receives email with signup link

### User Roles & Permissions

**Admin:**
- Full system access
- Company settings
- User management
- Module configuration

**Manager:**
- Department operations
- Create/edit transactions
- View reports
- Cannot change settings

**Accountant:**
- Financial data access
- Accounting operations
- Generate reports
- Cannot access operations modules

**Viewer:**
- Read-only access
- View reports
- No edit permissions

### Profile Management

**User Menu > Profile**

Each user can:
- Update their name
- Change email address
- Change password
- View account information

---

## Best Practices

### Daily Operations

✅ **Record transactions daily**
- Don't let invoices pile up
- Enter expenses promptly
- Record receipts immediately

✅ **Reconcile accounts weekly**
- Match bank statements
- Verify cash balances
- Check for discrepancies

✅ **Review reports regularly**
- Weekly cash flow
- Monthly P&L
- Quarterly balance sheet

### Month-End Procedures

1. **Review all transactions**
   - Ensure completeness
   - Verify accuracy
   - Fix errors

2. **Reconcile bank accounts**
   - Match statement to system
   - Investigate differences
   - Mark as reconciled

3. **Generate financial reports**
   - Profit & Loss
   - Balance Sheet
   - Cash Flow Statement

4. **Review aged receivables**
   - Follow up on overdue invoices
   - Send reminders
   - Plan collections

5. **Review aged payables**
   - Plan payments
   - Take early payment discounts
   - Manage cash flow

### Security Tips

🔒 **Strong passwords**
- Use complex passwords
- Change regularly
- Don't share credentials

🔒 **User access control**
- Give minimum necessary permissions
- Review user access quarterly
- Remove inactive users

🔒 **Regular backups**
- System backs up automatically
- Download periodic reports
- Keep copies of critical documents

### Data Quality

✅ **Consistent naming**
- Use standard customer/vendor names
- Consistent product descriptions
- Clear transaction descriptions

✅ **Proper categorization**
- Use correct account codes
- Consistent expense categories
- Proper tax classifications

✅ **Complete information**
- Fill in all required fields
- Add notes for clarity
- Attach supporting documents

---

## Support & Resources

### Getting Help

**In-App Support:**
- Click the **?** icon in top right
- Search knowledge base
- Submit support ticket

**Email Support:**
- support@blueox.com
- Response within 24 hours
- Include screenshots for faster resolution

**Training Resources:**
- Video tutorials (coming soon)
- Webinars
- Documentation center

### Common Questions

**Q: How do I change my company logo?**
A: Settings > Company > Upload Logo

**Q: Can I export my data?**
A: Yes, all reports can be exported to Excel or PDF

**Q: How do I invite my accountant?**
A: Settings > Users > Invite User (select "Accountant" role)

**Q: Can I undo a transaction?**
A: Delete or void the transaction, then create a correcting entry

**Q: How often is data backed up?**
A: Automatic real-time backups to secure cloud storage

**Q: Can I access the system on mobile?**
A: Yes, the web interface is mobile-responsive

### Keyboard Shortcuts

Speed up your workflow:

- `Ctrl/Cmd + K`: Quick search
- `Ctrl/Cmd + N`: New invoice (on invoice page)
- `Ctrl/Cmd + P`: Print/Save PDF
- `Ctrl/Cmd + S`: Save form
- `Esc`: Close modal/dialog

---

## Your Trial Period

You're currently on a **14-day free trial** which includes:

✅ Full access to all features
✅ Unlimited users
✅ All modules enabled
✅ Email support
✅ Data export capability

**After the trial:**
- Choose a subscription plan based on your needs
- Monthly or annual billing options
- Cancel anytime
- Your data is always accessible

---

## Next Steps

Now that you've completed the demo guide:

1. ✅ **Complete company setup**
   - Add company information
   - Upload logo
   - Set financial settings

2. ✅ **Import or add initial data**
   - Add customers
   - Add vendors
   - Set up chart of accounts

3. ✅ **Create your first transactions**
   - Issue an invoice
   - Record an expense
   - Enter a payment

4. ✅ **Generate your first report**
   - Run Profit & Loss
   - Check balances
   - Review dashboard metrics

5. ✅ **Invite team members**
   - Add users with appropriate roles
   - Assign permissions

---

## Welcome to BlueOx!

We're excited to have you on board. This system is designed to streamline your business operations and give you real-time insights into your financial health.

**Remember:**
- Take it one step at a time
- Use the built-in help resources
- Contact support if you need assistance
- Your feedback helps us improve

**Happy managing!** 🎉

---

*Last Updated: January 26, 2026*  
*Version: 2.0*  
*BlueOx Management System © 2026*
