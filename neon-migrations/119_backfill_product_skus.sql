-- Migration 119: give every product without a SKU a generated one
-- Products: PRD-000001..., services: SRV-000001..., numbered per company in the order they were
-- created, continuing after any SKUs already in that format. New products get the next number
-- from the app (src/lib/inventory/sku.ts) when the SKU is left blank.

WITH existing AS (
  SELECT company_id,
         CASE WHEN product_type = 'service' THEN 'SRV' ELSE 'PRD' END AS prefix,
         MAX(CAST(SUBSTRING(sku FROM '^(?:PRD|SRV)-(\d+)$') AS INT)) AS last
  FROM products
  WHERE sku ~ '^(PRD|SRV)-\d+$'
  GROUP BY 1, 2
),
missing AS (
  SELECT p.id, p.company_id,
         CASE WHEN p.product_type = 'service' THEN 'SRV' ELSE 'PRD' END AS prefix,
         ROW_NUMBER() OVER (
           PARTITION BY p.company_id, CASE WHEN p.product_type = 'service' THEN 'SRV' ELSE 'PRD' END
           ORDER BY p.created_at, p.id
         ) AS n
  FROM products p
  WHERE p.sku IS NULL OR btrim(p.sku) = ''
)
UPDATE products p
SET sku = m.prefix || '-' || LPAD((COALESCE(e.last, 0) + m.n)::TEXT, 6, '0'),
    updated_at = NOW()
FROM missing m
LEFT JOIN existing e ON e.company_id = m.company_id AND e.prefix = m.prefix
WHERE p.id = m.id;
