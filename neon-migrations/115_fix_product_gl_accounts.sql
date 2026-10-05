-- Migration 115: correct ledger accounts on products created from Stock Control
--
-- /api/inventory gave new products 1300 (Prepaid Expenses) as their inventory account and
-- 5100 (Cost of Services) as their COGS account. POS sales and invoices now post cost of
-- goods sold to a product's own accounts, so point those products at 1200 Inventory and
-- 5000 Cost of Goods Sold. Services keep 5100 and get no inventory account.

UPDATE products p
SET inventory_account_id = inv.id, updated_at = NOW()
FROM accounts wrong, accounts inv
WHERE p.inventory_account_id = wrong.id
  AND wrong.code = '1300'
  AND inv.code = '1200'
  AND inv.company_id = wrong.company_id
  AND COALESCE(p.product_type, 'inventory') <> 'service';

UPDATE products p
SET cogs_account_id = cogs.id, updated_at = NOW()
FROM accounts wrong, accounts cogs
WHERE p.cogs_account_id = wrong.id
  AND wrong.code = '5100'
  AND cogs.code = '5000'
  AND cogs.company_id = wrong.company_id
  AND COALESCE(p.product_type, 'inventory') <> 'service';

UPDATE products SET inventory_account_id = NULL, updated_at = NOW()
WHERE product_type = 'service' AND inventory_account_id IS NOT NULL;
