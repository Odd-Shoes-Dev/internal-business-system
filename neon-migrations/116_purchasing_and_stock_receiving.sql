-- Migration 116: make purchasing work, and receive stock in batches
--
-- The purchase order and goods receipt code was written against column names the schema
-- never had (po_date, expected_delivery_date, quantity, unit_price, ...) and against
-- company_id columns that were missing from purchase_orders, goods_receipts and
-- inventory_locations, so creating a purchase order or receiving goods always failed.
--
-- - Add the columns the code uses. The original columns stay and are kept in step by
--   triggers, so nothing that still reads them breaks.
-- - company_id on purchase_orders, goods_receipts, inventory_locations; PO, receipt and
--   location numbers become unique per company (each company numbers from 1).
-- - Goods receipts no longer need a purchase order ("receive stock" from any supplier).
-- - Received lines carry batch (lot), expiry and manufacture dates, and the purchase unit
--   they were counted in (e.g. 2 cartons x 24 = 48 units).
-- - 2150 Goods Received Not Invoiced: receiving debits Inventory and credits 2150; the
--   supplier's bill later debits 2150. Stock enters only through receiving.

-- ---------------------------------------------------------------- purchase_orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) NOT NULL DEFAULT 1;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_by UUID;

UPDATE purchase_orders po SET company_id = v.company_id
FROM vendors v WHERE v.id = po.vendor_id AND po.company_id IS NULL;

UPDATE purchase_orders
SET po_date = COALESCE(po_date, order_date),
    expected_delivery_date = COALESCE(expected_delivery_date, expected_date);

-- po_date / expected_delivery_date are what the code writes; mirror them into the old columns
-- (and the other way round if something still writes the old ones)
CREATE OR REPLACE FUNCTION sync_purchase_order_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.po_date := COALESCE(NEW.po_date, NEW.order_date, CURRENT_DATE);
    NEW.expected_delivery_date := COALESCE(NEW.expected_delivery_date, NEW.expected_date);
  ELSE
    IF NEW.po_date IS NOT DISTINCT FROM OLD.po_date AND NEW.order_date IS DISTINCT FROM OLD.order_date THEN
      NEW.po_date := NEW.order_date;
    END IF;
    IF NEW.expected_delivery_date IS NOT DISTINCT FROM OLD.expected_delivery_date
       AND NEW.expected_date IS DISTINCT FROM OLD.expected_date THEN
      NEW.expected_delivery_date := NEW.expected_date;
    END IF;
  END IF;
  NEW.order_date := COALESCE(NEW.po_date, CURRENT_DATE);
  NEW.expected_date := NEW.expected_delivery_date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_purchase_order_columns ON purchase_orders;
CREATE TRIGGER trg_sync_purchase_order_columns
  BEFORE INSERT OR UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION sync_purchase_order_columns();

ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_orders_company_number ON purchase_orders (company_id, po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company ON purchase_orders (company_id, po_date DESC);

-- ---------------------------------------------------------------- purchase_order_lines
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS quantity NUMERIC(15,4);
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS unit_price NUMERIC(15,4);
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS unit VARCHAR(50);
ALTER TABLE purchase_order_lines ALTER COLUMN quantity_ordered DROP NOT NULL;
ALTER TABLE purchase_order_lines ALTER COLUMN unit_cost DROP NOT NULL;
ALTER TABLE purchase_order_lines ALTER COLUMN quantity_received SET DEFAULT 0;

UPDATE purchase_order_lines
SET quantity = COALESCE(quantity, quantity_ordered),
    unit_price = COALESCE(unit_price, unit_cost);

CREATE OR REPLACE FUNCTION sync_purchase_order_line_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.quantity := COALESCE(NEW.quantity, NEW.quantity_ordered, 0);
    NEW.unit_price := COALESCE(NEW.unit_price, NEW.unit_cost, 0);
  ELSE
    IF NEW.quantity IS NOT DISTINCT FROM OLD.quantity AND NEW.quantity_ordered IS DISTINCT FROM OLD.quantity_ordered THEN
      NEW.quantity := NEW.quantity_ordered;
    END IF;
    IF NEW.unit_price IS NOT DISTINCT FROM OLD.unit_price AND NEW.unit_cost IS DISTINCT FROM OLD.unit_cost THEN
      NEW.unit_price := NEW.unit_cost;
    END IF;
  END IF;
  NEW.quantity_ordered := NEW.quantity;
  NEW.unit_cost := NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_purchase_order_line_columns ON purchase_order_lines;
CREATE TRIGGER trg_sync_purchase_order_line_columns
  BEFORE INSERT OR UPDATE ON purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION sync_purchase_order_line_columns();

-- ---------------------------------------------------------------- goods_receipts
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'received';
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS inspection_notes TEXT;
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS accepted_by UUID;
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE goods_receipts ALTER COLUMN purchase_order_id DROP NOT NULL;

UPDATE goods_receipts gr SET company_id = po.company_id, vendor_id = COALESCE(gr.vendor_id, po.vendor_id)
FROM purchase_orders po WHERE po.id = gr.purchase_order_id AND gr.company_id IS NULL;

ALTER TABLE goods_receipts DROP CONSTRAINT IF EXISTS goods_receipts_receipt_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_goods_receipts_company_number ON goods_receipts (company_id, receipt_number);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_company ON goods_receipts (company_id, received_date DESC);

-- ---------------------------------------------------------------- goods_receipt_lines
ALTER TABLE goods_receipt_lines ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE goods_receipt_lines ADD COLUMN IF NOT EXISTS lot_number VARCHAR(100);
ALTER TABLE goods_receipt_lines ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE goods_receipt_lines ADD COLUMN IF NOT EXISTS manufacture_date DATE;
-- What was counted at the door, in the supplier's unit; quantity_received is in stock units
ALTER TABLE goods_receipt_lines ADD COLUMN IF NOT EXISTS purchase_quantity NUMERIC(15,4);
ALTER TABLE goods_receipt_lines ADD COLUMN IF NOT EXISTS purchase_unit VARCHAR(50);
ALTER TABLE goods_receipt_lines ADD COLUMN IF NOT EXISTS units_per_purchase_unit NUMERIC(15,4);
ALTER TABLE goods_receipt_lines ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES inventory_lots(id);

ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS manufacture_date DATE;
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS goods_receipt_id UUID REFERENCES goods_receipts(id);

-- ---------------------------------------------------------------- inventory_locations
ALTER TABLE inventory_locations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
-- Locations created before this column existed belong to the only company, when there is one
UPDATE inventory_locations SET company_id = (SELECT id FROM companies LIMIT 1)
WHERE company_id IS NULL AND (SELECT COUNT(*) FROM companies) = 1;
ALTER TABLE inventory_locations DROP CONSTRAINT IF EXISTS inventory_locations_location_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_locations_company_code ON inventory_locations (company_id, location_code);

-- ---------------------------------------------------------------- 2150 Goods Received Not Invoiced
CREATE OR REPLACE FUNCTION seed_default_chart_of_accounts(p_company_id UUID)
RETURNS void AS $$
BEGIN

  INSERT INTO accounts (code, name, description, account_type, account_subtype, company_id, is_active)
  VALUES

    -- ============================================================
    -- ASSETS  (1000 – 1999)
    -- ============================================================
    ('1000', 'Cash on Hand',           'Physical cash held at the office',              'asset', 'cash',        p_company_id, true),
    ('1010', 'Petty Cash',             'Small cash fund for minor expenses',             'asset', 'cash',        p_company_id, true),
    ('1020', 'Checking Account',       'Primary bank checking account',                  'asset', 'bank',        p_company_id, true),
    ('1030', 'Savings Account',        'Bank savings account',                           'asset', 'bank',        p_company_id, true),
    ('1040', 'Mobile Money',           'Mobile money wallet balances (MTN, Airtel, etc.)', 'asset', 'cash',      p_company_id, true),
    ('1100', 'Accounts Receivable',    'Amounts owed by customers',                      'asset', 'receivable',  p_company_id, true),
    ('1200', 'Inventory',              'Goods held for sale',                            'asset', 'inventory',   p_company_id, true),
    ('1300', 'Prepaid Expenses',       'Expenses paid in advance',                       'asset', 'other_asset', p_company_id, true),
    ('1500', 'Property & Equipment',   'Land, buildings, and equipment',                 'asset', 'fixed_asset', p_company_id, true),
    ('1510', 'Vehicles',               'Company-owned vehicles',                         'asset', 'fixed_asset', p_company_id, true),
    ('1520', 'Office Equipment',       'Computers, printers, furniture',                 'asset', 'fixed_asset', p_company_id, true),
    ('1590', 'Accumulated Depreciation','Depreciation on fixed assets',                  'asset', 'fixed_asset', p_company_id, true),

    -- ============================================================
    -- LIABILITIES  (2000 – 2999)
    -- ============================================================
    ('2000', 'Accounts Payable',       'Amounts owed to vendors/suppliers',              'liability', 'payable',          p_company_id, true),
    ('2100', 'Accrued Expenses',       'Expenses incurred but not yet paid',             'liability', 'accrued',          p_company_id, true),
    ('2110', 'PAYE Payable',           'Income tax withheld from employees, owed to URA', 'liability', 'other_liability', p_company_id, true),
    ('2120', 'NSSF Payable',           'Employee and employer NSSF contributions owed',   'liability', 'other_liability', p_company_id, true),
    ('2150', 'Goods Received Not Invoiced', 'Stock received from suppliers whose bill has not been entered yet', 'liability', 'payable', p_company_id, true),
    ('2200', 'VAT / Sales Tax Payable','Tax collected on sales, owed to government',     'liability', 'other_liability',  p_company_id, true),
    ('2300', 'Salaries Payable',       'Employee salaries owed but not yet paid',        'liability', 'accrued',          p_company_id, true),
    ('2400', 'Short-Term Loans',       'Loans due within one year',                      'liability', 'loan',             p_company_id, true),
    ('2500', 'Long-Term Loans',        'Loans due after one year',                       'liability', 'loan',             p_company_id, true),
    ('2600', 'Deferred Revenue',       'Payments received before services rendered',     'liability', 'other_liability',  p_company_id, true),
    ('2700', 'Customer Deposits',      'Advance deposits received from customers',       'liability', 'other_liability',  p_company_id, true),

    -- ============================================================
    -- EQUITY  (3000 – 3999)
    -- ============================================================
    ('3000', 'Owner''s Capital',       'Owner equity / paid-in capital',                 'equity', 'capital',           p_company_id, true),
    ('3100', 'Retained Earnings',      'Accumulated profits retained in the business',   'equity', 'retained_earnings', p_company_id, true),
    ('3200', 'Owner''s Drawings',      'Withdrawals made by the owner',                  'equity', 'capital',           p_company_id, true),

    -- ============================================================
    -- REVENUE  (4000 – 4999)
    -- ============================================================
    ('4000', 'Sales Revenue',          'Income from product sales',                      'revenue', 'sales',        p_company_id, true),
    ('4100', 'Service Revenue',        'Income from services rendered',                  'revenue', 'service',      p_company_id, true),
    ('4200', 'Tour Revenue',           'Income from tour packages and bookings',         'revenue', 'service',      p_company_id, true),
    ('4300', 'Hotel Revenue',          'Income from hotel accommodation',                'revenue', 'service',      p_company_id, true),
    ('4400', 'Rental Revenue',         'Income from vehicle or equipment rentals',       'revenue', 'service',      p_company_id, true),
    ('4900', 'Other Income',           'Miscellaneous or non-operating income',          'revenue', 'other_income', p_company_id, true),

    -- ============================================================
    -- COST OF GOODS SOLD  (5000 – 5999)
    -- ============================================================
    ('5000', 'Cost of Goods Sold',     'Direct cost of products sold',                   'expense', 'cost_of_goods', p_company_id, true),
    ('5100', 'Cost of Services',       'Direct cost of services delivered',              'expense', 'cost_of_goods', p_company_id, true),
    ('5200', 'Tour Operating Costs',   'Direct costs for running tours',                 'expense', 'cost_of_goods', p_company_id, true),
    ('5300', 'Inventory Write-offs',   'Damaged, expired or missing stock written off',  'expense', 'cost_of_goods', p_company_id, true),

    -- ============================================================
    -- OPERATING EXPENSES  (6000 – 6999)
    -- ============================================================
    ('6000', 'Salaries & Wages',       'Employee salaries, wages, and benefits',         'expense', 'operating',       p_company_id, true),
    ('6010', 'Payroll Taxes',          'Employer payroll tax contributions',              'expense', 'operating',       p_company_id, true),
    ('6100', 'Rent & Lease',           'Office, warehouse, or facility rent',            'expense', 'operating',       p_company_id, true),
    ('6110', 'Utilities',              'Electricity, water, internet, gas',              'expense', 'operating',       p_company_id, true),
    ('6120', 'Office Supplies',        'Stationery, printing, and office materials',     'expense', 'operating',       p_company_id, true),
    ('6130', 'Telephone & Internet',   'Phone bills and internet subscriptions',         'expense', 'operating',       p_company_id, true),
    ('6200', 'Travel & Accommodation', 'Business travel, hotels, and per diem',          'expense', 'operating',       p_company_id, true),
    ('6210', 'Fuel & Transport',       'Fuel, taxi, and local transport costs',          'expense', 'operating',       p_company_id, true),
    ('6220', 'Vehicle Maintenance',    'Repairs and maintenance of company vehicles',    'expense', 'operating',       p_company_id, true),
    ('6300', 'Marketing & Advertising','Ads, promotions, and marketing materials',       'expense', 'marketing',       p_company_id, true),
    ('6310', 'Website & Software',     'Website hosting, SaaS tools, software',         'expense', 'marketing',       p_company_id, true),
    ('6400', 'Professional Fees',      'Accounting, legal, and consulting fees',         'expense', 'administrative',  p_company_id, true),
    ('6410', 'Bank Charges & Fees',    'Bank service charges and transaction fees',      'expense', 'administrative',  p_company_id, true),
    ('6420', 'Insurance',              'Business, liability, and asset insurance',       'expense', 'administrative',  p_company_id, true),
    ('6430', 'Licences & Permits',     'Government licences and regulatory permits',     'expense', 'administrative',  p_company_id, true),
    ('6440', 'Subscriptions',          'Business subscriptions and memberships',         'expense', 'administrative',  p_company_id, true),
    ('6500', 'Meals & Entertainment',  'Client meals and business entertainment',        'expense', 'operating',       p_company_id, true),
    ('6600', 'Training & Development', 'Staff training and development costs',           'expense', 'administrative',  p_company_id, true),
    ('6700', 'Depreciation Expense',   'Periodic depreciation of fixed assets',         'expense', 'depreciation',    p_company_id, true),
    ('6800', 'Bad Debt Expense',       'Uncollectable customer receivables',             'expense', 'operating',       p_company_id, true),
    ('6900', 'Miscellaneous Expense',  'Other operating expenses not classified above',  'expense', 'other_expense',   p_company_id, true),

    -- ============================================================
    -- OTHER INCOME / EXPENSE  (7000 – 7999)
    -- ============================================================
    ('7000', 'Interest Income',        'Interest earned on bank accounts',               'revenue', 'other_income', p_company_id, true),
    ('7100', 'Interest Expense',       'Interest paid on loans and credit',              'expense', 'other_expense', p_company_id, true),
    ('7200', 'Exchange Gain/Loss',     'Foreign currency exchange differences',          'expense', 'other_expense', p_company_id, true)

  ON CONFLICT (code, company_id) DO NOTHING;

END;
$$ LANGUAGE plpgsql;

INSERT INTO accounts (code, name, description, account_type, account_subtype, company_id, is_active)
SELECT '2150', 'Goods Received Not Invoiced', 'Stock received from suppliers whose bill has not been entered yet', 'liability', 'payable', id, true
FROM companies
ON CONFLICT (code, company_id) DO NOTHING;
