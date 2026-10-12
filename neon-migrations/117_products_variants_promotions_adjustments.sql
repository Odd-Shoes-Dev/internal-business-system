-- Migration 117: product details, variants, stock adjustments with approval, promotions
--
-- - Products: shelf location; purchase unit with a conversion factor (buy in cartons of 24,
--   sell in pieces); variants as child products (parent_product_id + attributes such as
--   {"Size": "L", "Colour": "Red"}) so stock, FIFO, sales and reports treat each variant as
--   an ordinary product.
-- - SKUs were unique across all companies, so two companies could not both use "PROD-001";
--   make SKU and barcode unique per company instead.
-- - Stock adjustments: a request (count correction, damage, expiry, theft...) that moves stock
--   and posts to the ledger only once approved.
-- - Promotions: percentage or fixed discounts and buy-X-get-Y offers on chosen products,
--   within a date window, applied automatically at the till.
-- - 3050 Opening Balance Equity: stock entered as a product's initial quantity is posted
--   Dr Inventory / Cr 3050.

-- ---------------------------------------------------------------- products
ALTER TABLE products ADD COLUMN IF NOT EXISTS shelf_location VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_unit VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS units_per_purchase_unit NUMERIC(15,4) NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_product_id UUID REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_attributes JSONB;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_units_per_purchase_unit_positive') THEN
    ALTER TABLE products ADD CONSTRAINT products_units_per_purchase_unit_positive CHECK (units_per_purchase_unit > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_parent ON products (parent_product_id) WHERE parent_product_id IS NOT NULL;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_company_sku ON products (company_id, sku) WHERE sku IS NOT NULL AND sku <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_company_barcode ON products (company_id, barcode) WHERE barcode IS NOT NULL AND barcode <> '';

-- ---------------------------------------------------------------- stock adjustments
CREATE SEQUENCE IF NOT EXISTS stock_adjustment_number_seq;

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  adjustment_number VARCHAR(50) NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_change NUMERIC(15,4) NOT NULL CHECK (quantity_change <> 0),
  reason VARCHAR(30) NOT NULL CHECK (reason IN (
    'count_correction', 'damage', 'expired', 'theft', 'spoilage', 'found', 'internal_use', 'other'
  )),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  source VARCHAR(30) NOT NULL DEFAULT 'manual', -- 'manual' | 'stock_take'
  source_id UUID,
  unit_cost NUMERIC(15,4), -- set on approval: FIFO cost taken out, or cost of stock found
  total_cost NUMERIC(15,2),
  requested_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, adjustment_number)
);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_company_status ON stock_adjustments (company_id, status, created_at DESC);

-- ---------------------------------------------------------------- promotions
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  -- percentage: discount_value % off; fixed: discount_value off each unit;
  -- buy_x_get_y: for every buy_quantity bought, get_quantity more are free
  type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed', 'buy_x_get_y')),
  discount_value NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  buy_quantity INT CHECK (buy_quantity IS NULL OR buy_quantity > 0),
  get_quantity INT CHECK (get_quantity IS NULL OR get_quantity > 0),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  CHECK (type <> 'percentage' OR discount_value <= 100),
  CHECK (type <> 'buy_x_get_y' OR (buy_quantity IS NOT NULL AND get_quantity IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_promotions_company_active ON promotions (company_id, is_active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS promotion_products (
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_promotion_products_product ON promotion_products (product_id);

-- ---------------------------------------------------------------- 3050 Opening Balance Equity
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
    ('3050', 'Opening Balance Equity', 'Value of stock and balances brought in when starting on the system', 'equity', 'capital', p_company_id, true),
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
SELECT '3050', 'Opening Balance Equity', 'Value of stock and balances brought in when starting on the system', 'equity', 'capital', id, true
FROM companies
ON CONFLICT (code, company_id) DO NOTHING;
