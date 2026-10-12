-- Migration 113: POS and inventory accounting fixes
--
-- 1. 'reserved' movement type: quotations reserve stock with movement_type 'reserved', which
--    was never added to stock_movement_type, so reserving stock failed.
-- 2. POS sale numbers: POS sales were numbered POS-<year>-<count per company>, but invoice
--    numbers are unique across all companies, so a second company's first POS sale collided.
--    A global sequence (like payment numbers) gives unique numbers without races.
-- 3. Accounts: 1040 Mobile Money (POS mobile money payments) and 5300 Inventory Write-offs
--    (damaged / expired stock), added to the seed function and backfilled for existing companies.
-- 4. Index for FIFO lot lookups.

ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'reserved';

CREATE SEQUENCE IF NOT EXISTS pos_sale_number_seq;

-- Continue after any POS numbers already issued
SELECT setval(
  'pos_sale_number_seq',
  GREATEST(
    COALESCE((
      SELECT MAX(CAST(SUBSTRING(invoice_number FROM 'POS-\d{4}-(\d+)$') AS BIGINT))
      FROM invoices
      WHERE invoice_number ~ '^POS-\d{4}-\d+$'
    ), 0),
    1
  ),
  EXISTS (SELECT 1 FROM invoices WHERE invoice_number ~ '^POS-\d{4}-\d+$')
);

CREATE OR REPLACE FUNCTION generate_pos_sale_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'POS-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('pos_sale_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

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
SELECT '1040', 'Mobile Money', 'Mobile money wallet balances (MTN, Airtel, etc.)', 'asset', 'cash', id, true
FROM companies
ON CONFLICT (code, company_id) DO NOTHING;

INSERT INTO accounts (code, name, description, account_type, account_subtype, company_id, is_active)
SELECT '5300', 'Inventory Write-offs', 'Damaged, expired or missing stock written off', 'expense', 'cost_of_goods', id, true
FROM companies
ON CONFLICT (code, company_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_inventory_lots_fifo
  ON inventory_lots (product_id, expiry_date, received_date)
  WHERE quantity_remaining > 0;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference
  ON inventory_movements (reference_type, reference_id);
