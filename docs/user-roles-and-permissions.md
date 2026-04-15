# User Roles & Permissions

## Overview

BlueOx uses a **role-based access control (RBAC)** system. Every user has one role assigned per company. Roles control which sidebar sections they see and which pages they can access.

There are two layers of enforcement:
1. **Sidebar filtering** — users only see navigation items their role permits
2. **Route-level guard** — if a user navigates directly to a restricted URL, they see an "Access Restricted" page instead of the content

---

## Available Roles

| Role | Description |
|---|---|
| **admin** | Full access to everything — company settings, billing, all financial data, all modules |
| **accountant** | Full access to finance, accounting, reports, payroll, employees, inventory |
| **operations** | Access to operational modules — tours, fleet, hotels, cafe, inventory, employees |
| **sales** | Access to customer-facing revenue — invoices, receipts, customers, tours, bookings |
| **guide** | Minimal access — tour packages and bookings only |
| **viewer** | Dashboard home only — read-only observer with no module access |

---

## Role Permission Matrix

| Section / Page | admin | accountant | operations | sales | guide | viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard (home) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Sales & Revenue** | | | | | | |
| Invoices | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Receipts | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Payments | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Proformas | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Finance** | | | | | | |
| Bills | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Expenses | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Bank & Cash | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Accounting** | | | | | | |
| General Ledger | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reports | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Relationships** | | | | | | |
| Customers | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Vendors | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **People & Payroll** | | | | | | |
| Employees | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Payroll Processing | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Assets & Inventory** | | | | | | |
| Inventory | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Fixed Assets | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Tour Operations** | | | | | | |
| Tour Packages | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Bookings | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Operational Modules** | | | | | | |
| Fleet Management | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Hotels Management | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Cafe Operations | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Destinations | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **System** | | | | | | |
| Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Billing & Subscription | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Invitation System

### How It Works

1. **Admin** goes to Settings → Users → Invite User
2. Enters the invitee's email and selects a role
3. A **7-day invitation email** is sent via Resend to the invitee
4. The invitee clicks the link → `/invite/[token]`
5. If they **don't have an account** — they fill in their name and set a password
6. If they **already have a BlueOx account** — they verify with their existing password
7. They are added to the company with the assigned role and redirected to the dashboard

### Invitation Rules

- One active pending invite per email per company
- Invitations expire after **7 days**
- Admins can **revoke** a pending invitation before it is accepted
- Once accepted, the invitation cannot be reused (token is one-time)
- An existing user can be invited into multiple companies — they log in once and switch between companies

### Roles Available During Invitation

`admin`, `accountant`, `operations`, `sales`, `guide`, `viewer`

> **Note:** `owner` is not assignable via invitation. The company owner is the person who originally registered the company.

---

## Database Tables

| Table | Purpose |
|---|---|
| `app_users` | Stores all user accounts (email, password hash, global role) |
| `user_companies` | Links users to companies with a company-specific role |
| `user_invitations` | Stores pending/accepted/revoked invitations with token and expiry |
| `app_sessions` | Stores active session tokens for authentication |

### Key Columns

**`app_users.role`** — Global role stored on the user account. Set to the invited role when the account is created via invitation.

**`user_companies.role`** — Role within a specific company. Controls dashboard access. Can differ from the global role if a user belongs to multiple companies.

---

## Role Constraints (Database)

```sql
-- app_users role constraint (migration 072_auth_core.sql)
CHECK (role IN ('admin', 'accountant', 'operations', 'sales', 'guide', 'viewer'))

-- user_invitations role constraint (migration 076_fix_user_invitations.sql)
CHECK (role IN ('admin', 'manager', 'accountant', 'operations', 'sales', 'guide', 'viewer'))
```

> `manager` appears in the `user_invitations` constraint for backward compatibility with migration 059, but it is not assignable via the UI or API and does not exist as a valid role in `app_users`.

---

## Multi-User Login

Multiple users can be members of the same company. Each user has their own account and logs in independently — there are no conflicts. The session is tied to the individual user, not the company.

A user can also belong to **multiple companies**. When they log in, the system selects their primary company. Company switching can be implemented in a future update.

---

## Files Reference

| File | Purpose |
|---|---|
| `src/app/dashboard/layout.tsx` | Sidebar role filtering + route access guard |
| `src/app/dashboard/settings/page.tsx` | Team members + invitation management UI |
| `src/app/api/invitations/route.ts` | GET team list / POST send invitation |
| `src/app/api/invitations/[token]/route.ts` | GET validate token / DELETE revoke |
| `src/app/api/invitations/[token]/accept/route.ts` | POST accept invitation |
| `src/app/invite/[token]/page.tsx` | Accept invitation UI page |
| `src/lib/email/resend.ts` | `sendInvitationEmail()` function + HTML template |
| `src/types/database.ts` | `UserRole` TypeScript type |
| `neon-migrations/059_create_user_invitations_table.sql` | Original invitations table |
| `neon-migrations/076_fix_user_invitations.sql` | Fix FK to `app_users`, add `revoked_at` |
