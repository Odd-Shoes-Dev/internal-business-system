import type { QueryExecutor } from '@/lib/accounting/provider-accounting';

// SKUs left blank are numbered per company: PRD-000001 for products, SRV-000001 for services.
export function skuPrefix(productType: string | null | undefined): string {
  return productType === 'service' ? 'SRV' : 'PRD';
}

export function formatSku(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(6, '0')}`;
}

// Next free SKU for the company. Call inside a transaction: the advisory lock makes two
// products saved at the same moment get different numbers.
export async function nextSkuWithDb(q: QueryExecutor, companyId: string, productType?: string | null): Promise<string> {
  const prefix = skuPrefix(productType);
  await q.query("SELECT pg_advisory_xact_lock(hashtext('product_sku:' || $1 || ':' || $2))", [companyId, prefix]);
  const result = await q.query<{ last: number | null }>(
    `SELECT MAX(CAST(SUBSTRING(sku FROM '^' || $2 || '-(\\d+)$') AS INT)) AS last
     FROM products WHERE company_id = $1 AND sku ~ ('^' || $2 || '-\\d+$')`,
    [companyId, prefix]
  );
  return formatSku(prefix, Number(result.rows[0]?.last || 0) + 1);
}
