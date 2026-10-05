import { NextResponse } from 'next/server';
import type { QueryExecutor } from '@/lib/accounting/provider-accounting';

export const PROMOTION_MANAGER_ROLES = ['owner', 'admin', 'operations', 'accountant'];

export async function requirePromotionManager(q: QueryExecutor, userId: string, companyId: string) {
  const r = await q.query<{ role: string | null }>('SELECT role FROM user_companies WHERE user_id = $1 AND company_id = $2', [userId, companyId]);
  if (!PROMOTION_MANAGER_ROLES.includes(r.rows[0]?.role || '')) {
    return NextResponse.json({ error: 'Your role cannot manage promotions' }, { status: 403 });
  }
  return null;
}

// Validates a promotion body; returns the clean values or an error message
export function parsePromotion(body: any): { value?: any; error?: string } {
  const type = body.type;
  if (!['percentage', 'fixed', 'buy_x_get_y'].includes(type)) return { error: 'Choose a promotion type' };
  const name = String(body.name || '').trim();
  if (!name) return { error: 'Give the promotion a name' };
  const startsAt = new Date(body.starts_at);
  const endsAt = new Date(body.ends_at);
  if (isNaN(+startsAt) || isNaN(+endsAt) || endsAt <= startsAt) return { error: 'The end must be after the start' };
  const discount = Number(body.discount_value || 0);
  if (type !== 'buy_x_get_y' && !(discount > 0)) return { error: 'Enter the discount' };
  if (type === 'percentage' && discount > 100) return { error: 'A percentage cannot be over 100' };
  const buy = type === 'buy_x_get_y' ? parseInt(body.buy_quantity, 10) : null;
  const get = type === 'buy_x_get_y' ? parseInt(body.get_quantity, 10) : null;
  if (type === 'buy_x_get_y' && !(buy! > 0 && get! > 0)) return { error: 'Enter how many to buy and how many are free' };
  const productIds: string[] = Array.isArray(body.product_ids) ? [...new Set(body.product_ids as string[])] : [];
  if (!productIds.length) return { error: 'Choose at least one product' };
  return {
    value: {
      name: name.slice(0, 200), description: body.description || null, type,
      discount_value: type === 'buy_x_get_y' ? 0 : discount, buy_quantity: buy, get_quantity: get,
      starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), is_active: body.is_active !== false, productIds,
    },
  };
}

export async function savePromotionProducts(q: QueryExecutor, promotionId: string, companyId: string, productIds: string[]) {
  const owned = await q.query<{ id: string }>('SELECT id FROM products WHERE id = ANY($1::uuid[]) AND company_id = $2', [productIds, companyId]);
  await q.query('DELETE FROM promotion_products WHERE promotion_id = $1', [promotionId]);
  for (const row of owned.rows) {
    await q.query('INSERT INTO promotion_products (promotion_id, product_id) VALUES ($1, $2)', [promotionId, row.id]);
  }
}
