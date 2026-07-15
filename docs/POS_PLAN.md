# POS (Point of Sale) — Build Plan

## Overview

A full-screen, keyboard and barcode-scanner driven POS till that runs as a
separate surface (`/pos/...`) over the same database as the main dashboard.
POS sales feed directly into the existing accounting, inventory, and reporting
infrastructure — no duplication, no interference.

**Module type:** Paid add-on (`pos` in `AVAILABLE_MODULES`)  
**Access:** Companies that subscribe to the POS module get the till + manager dashboard  
**Complementary modules:** Works alongside Inventory (stock deduction) and core receipts

---

## Architecture Decision

```
Main Dashboard (/dashboard/...)     POS (/pos/...)
        |                                  |
        └──────────── Same Neon DB ────────┘
                            |
          products, invoices, payments_received,
          customers, exchange_rates, inventory
```

- POS has its own layout — full screen, no sidebar, optimized for touchscreen and keyboard
- POS writes to shared tables using `document_type: 'pos_sale'` and `source: 'pos'`
  to stay invisible to the invoice/receipt list UIs while still appearing in reports
- All existing reports (revenue, tax, sales by customer) automatically include POS sales
  because they read the same underlying tables

---

## Phase 1 — Core (Build Now)

### Step 1 — Database Migration

Add to `neon-migrations/`:

```sql
-- Barcode support on products
ALTER TABLE products ADD COLUMN barcode VARCHAR UNIQUE;

-- Track payment source
ALTER TABLE payments_received ADD COLUMN source VARCHAR DEFAULT 'manual';
-- values: 'manual' | 'pos'

-- POS terminals (one row per physical till device)
CREATE TABLE pos_terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR NOT NULL,         -- e.g. "Till 1", "Front Counter"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- POS sessions (one per shift)
CREATE TABLE pos_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  terminal_id UUID NOT NULL REFERENCES pos_terminals(id),
  opened_by UUID NOT NULL REFERENCES profiles(id),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_float NUMERIC(15,2) DEFAULT 0,   -- cash in drawer at start of shift
  closing_cash_count NUMERIC(15,2),        -- cash counted at end of shift
  expected_cash NUMERIC(15,2),             -- float + cash sales
  variance NUMERIC(15,2),                  -- closing_cash_count - expected_cash
  status VARCHAR DEFAULT 'open',           -- 'open' | 'closed'
  currency VARCHAR DEFAULT 'UGX',
  notes TEXT
);
```

---

### Step 2 — Products: Barcode Support

**Files to update:**
- `src/app/api/products/route.ts` — accept `barcode` in POST/PATCH
- `src/app/api/products/route.ts` — add `GET ?barcode=xxx` lookup
- `src/app/dashboard/products/page.tsx` — add barcode field to create/edit form
- `src/app/dashboard/price-list/page.tsx` — add barcode field if separate

**New feature — Scan to Register:**
- Button on products list: "Scan Barcode"
- Scan unknown barcode → modal: "No product found for [barcode]. Assign to existing product or create new?"
- Saves barcode to product record
- Allows gradual barcode registration without opening each product individually

---

### Step 3 — Module Registration

**File:** `src/lib/modules.ts`

```typescript
pos: {
  id: 'pos',
  name: 'Point of Sale',
  description: 'Full-screen till with barcode scanner support, shift management, and thermal receipts',
  price: /* set price */,
  icon: 'ShoppingCartIcon',
  category: 'operations',
}
```

- Add to sidebar navigation (visible only when module active)
- Add to billing/add-modules page

---

### Step 4 — API Routes

```
POST   /api/pos/sessions              Open a new shift
PATCH  /api/pos/sessions/[id]         Close shift (with cash count)
GET    /api/pos/sessions              List sessions for company
GET    /api/pos/sessions/[id]         Single session detail

POST   /api/pos/transactions          Record a sale:
                                       - Creates invoice (document_type: 'pos_sale')
                                       - Creates invoice_lines
                                       - Creates payments_received (source: 'pos')
                                       - Deducts inventory if module active
GET    /api/pos/transactions          List POS sales (manager view)

GET    /api/products?barcode=xxx      Barcode lookup (returns single product)
```

---

### Step 5 — Manager Dashboard `/dashboard/pos`

**What a manager or owner sees:**

- Active terminals with status (open/closed shift)
- "Open Till" button per terminal → starts shift flow → redirects to till screen
- Today's totals: transaction count + total revenue
- Shift history table: terminal, cashier, open time, close time, sales total, variance
- Link to all POS transactions

---

### Step 6 — Till Screen `/pos/session/[sessionId]`

**Separate layout** (`src/app/pos/layout.tsx`) — full screen, no sidebar, no dashboard header.

```
┌─────────────────────────────────────────────────────────────┐
│ [🔍 Barcode / Search _______________]  Cashier: Dan  [Close Shift] │
├──────────────────────────────┬──────────────────────────────┤
│                              │  CART                        │
│  Product Grid                │  Bread x2          USh 4,000 │
│                              │  Milk  x1          USh 3,500 │
│  [Bread    USh 2,000]       │  ──────────────────────────  │
│  [Milk     USh 3,500]       │  Subtotal          USh 7,500 │
│  [Sugar    USh 4,000]       │  Tax (18%)         USh 1,350 │
│  [Rice     USh 6,000]       │  TOTAL             USh 8,850 │
│  [...]                       │                              │
│                              │  [Cash] [Card] [Mobile]      │
│                              │                              │
│                              │  Tendered  [__________]      │
│                              │  Change    USh 1,150         │
│                              │                              │
│                              │  [    CHARGE & PRINT    ]    │
└──────────────────────────────┴──────────────────────────────┘
```

**Barcode input behaviour:**
- Input is always focused
- Barcode scanner types the barcode + Enter
- System looks up `GET /api/products?barcode=xxx`
- If found → instantly adds to cart
- If not found → shows "Unknown barcode — search by name?"
- Name search fallback always available

**Payment:**
- Cash → tendered field → auto-calculates change
- Card → records amount (no gateway, just tracking)
- Mobile money → records amount + reference number
- Split payment → e.g. USh 5,000 cash + USh 3,850 card

**On completing sale:**
1. POST `/api/pos/transactions` → creates invoice + payment + deducts stock
2. Opens thermal receipt print dialog
3. Clears cart instantly → ready for next customer

---

### Step 7 — Shift Management

**Open shift flow:**
- Manager clicks "Open Till" on `/dashboard/pos`
- Modal: enter opening float (cash in drawer)
- POST `/api/pos/sessions` → session created
- Redirect to `/pos/session/[sessionId]`

**Close shift flow:**
- Cashier clicks "Close Shift" on till screen
- Modal: enter cash counted in drawer
- System shows:
  - Opening float: USh 50,000
  - Cash sales today: USh 120,000
  - Expected cash: USh 170,000
  - You counted: USh 168,000
  - Variance: -USh 2,000
- PATCH `/api/pos/sessions/[id]` → session closed
- Redirect to manager dashboard with shift summary

---

### Step 8 — Thermal Receipt

**Format:** 80mm width, black and white, no gradients, high contrast

```
================================
     ZENTURI WATER SOLUTIONS
       Kampala, Uganda
       Tel: +256 xxx xxx xxx
================================
Date: 15/07/2026  Time: 14:32
Till: Front Counter
Cashier: Dan L
Session: #POS-2026-00045
--------------------------------
Bread (x2)          USh  4,000
Milk  (x1)          USh  3,500
Sugar (x1)          USh  4,000
--------------------------------
Subtotal            USh 11,500
Tax (18%)           USh  2,070
TOTAL               USh 13,570
--------------------------------
Cash Tendered       USh 15,000
Change              USh  1,430
================================
       Thank you for shopping
       with us. Come again!
================================
```

Separate print stylesheet (`@media print`) — narrow margins, monospace or clean sans-serif, no colours.

---

## Phase 2 — Scale (Build Later)

These do not require rewriting anything from Phase 1. Each is an addition:

### Offline Mode
- Cache product catalogue in IndexedDB on the till device
- Queue transactions locally when network is lost
- Sync to server on reconnect
- Show sync status indicator on till screen

### Returns & Refunds
- "Return" button on till screen
- Scan or search original transaction
- Select items to return
- Creates negative `pos_sale` invoice
- Restores inventory stock
- Issues cash/credit refund

### Multiple Terminals
- Each physical till is a registered `pos_terminal`
- Multiple sessions open simultaneously on different terminals
- Manager dashboard shows all terminals with live status

### Loyalty Points
- Tie to `customers` table
- Earn points per purchase
- Redeem at till as discount
- Points balance on customer profile

### Z-Report / X-Report
- X-Report: print current shift totals without closing (mid-day check)
- Z-Report: end of day report across all terminals
  - Total sales by payment method
  - Tax collected
  - Cash variance per terminal
  - Top selling products

### Barcode Label Printing
- Generate barcode from product code or custom number
- Print labels in bulk (e.g. for 50 products at once)
- Supports common label sizes (30mm x 20mm, 58mm x 40mm)

### Kitchen Display System (Restaurants)
- Items tagged as "kitchen items" route to a kitchen screen
- Kitchen staff mark items as prepared
- Till notified when order is ready

### Inventory Alerts at Till
- Low stock warning when adding item to cart
- "Only 2 left in stock" shown to cashier
- Optional block on sale if stock = 0

---

## Data Flow Summary

```
POS Sale
   │
   ├── invoices (document_type: 'pos_sale', status: 'paid')
   │       └── invoice_lines (one per cart item)
   │
   ├── payments_received (source: 'pos', amount = invoice total)
   │
   ├── inventory (quantity deducted per item if module active)
   │
   └── pos_sessions (transaction linked to session)

Reports pick up automatically:
   Revenue report    ← reads invoices (includes pos_sale)
   Tax summary       ← reads invoice_lines tax
   Sales by customer ← reads invoices joined customers
   Receipt list      ← reads payments_received (shows source: pos badge)
   
Invoice list UI     ← filters document_type = 'invoice' ONLY (excludes POS)
```

---

## File Structure (new files only)

```
src/
  app/
    pos/
      layout.tsx                        ← Full screen layout, no sidebar
      session/
        [sessionId]/
          page.tsx                      ← The till screen
    dashboard/
      pos/
        page.tsx                        ← Manager dashboard
  api/
    pos/
      sessions/
        route.ts                        ← POST (open), GET (list)
        [id]/
          route.ts                      ← PATCH (close), GET (detail)
      transactions/
        route.ts                        ← POST (record sale), GET (list)

neon-migrations/
  XXXX_pos_tables.sql                   ← pos_terminals, pos_sessions,
                                           barcode on products, source on payments
```

---

## Build Order

```
1. Database migration
2. Products: barcode field + scan-to-register UI
3. Module registration + sidebar entry
4. API routes (sessions + transactions + barcode lookup)
5. Manager dashboard (/dashboard/pos)
6. Till screen (/pos/session/[sessionId])
7. Shift open/close flow
8. Thermal receipt format
```

Each step is independently usable before the next begins.
