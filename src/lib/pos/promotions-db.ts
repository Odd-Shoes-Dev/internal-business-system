import type { QueryExecutor } from '@/lib/accounting/provider-accounting';
import type { Promotion } from '@/lib/pos/promotions';

const SELECT = `
  SELECT pr.id, pr.name, pr.description, pr.type, pr.discount_value::float AS discount_value,
         pr.buy_quantity, pr.get_quantity, pr.starts_at, pr.ends_at, pr.is_active, pr.created_at,
         COALESCE(array_agg(pp.product_id) FILTER (WHERE pp.product_id IS NOT NULL), '{}') AS product_ids
  FROM promotions pr
  LEFT JOIN promotion_products pp ON pp.promotion_id = pr.id`;

export async function listPromotionsWithDb(q: QueryExecutor, companyId: string, liveOnly = false): Promise<Promotion[]> {
  const result = await q.query<Promotion>(
    `${SELECT}
     WHERE pr.company_id = $1 ${liveOnly ? 'AND pr.is_active AND pr.starts_at <= NOW() AND pr.ends_at > NOW()' : ''}
     GROUP BY pr.id
     ORDER BY pr.starts_at DESC`,
    [companyId]
  );
  return result.rows;
}

// Live promotions covering any of these products
export async function livePromotionsForProductsWithDb(q: QueryExecutor, companyId: string, productIds: string[]): Promise<Promotion[]> {
  if (!productIds.length) return [];
  const result = await q.query<Promotion>(
    `${SELECT}
     WHERE pr.company_id = $1 AND pr.is_active AND pr.starts_at <= NOW() AND pr.ends_at > NOW()
       AND EXISTS (SELECT 1 FROM promotion_products x WHERE x.promotion_id = pr.id AND x.product_id = ANY($2::uuid[]))
     GROUP BY pr.id`,
    [companyId, productIds]
  );
  return result.rows;
}
