import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { listPromotionsWithDb } from '@/lib/pos/promotions-db';
import { parsePromotion, requirePromotionManager, savePromotionProducts } from './shared';

// GET /api/promotions?company_id=&live=true
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const live = new URL(request.url).searchParams.get('live') === 'true';
    return NextResponse.json({ data: await listPromotionsWithDb(db, companyId, live) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/promotions — { company_id, name, type, discount_value | buy_quantity + get_quantity, starts_at, ends_at, product_ids }
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const body = await request.json();
    const companyId = getCompanyIdFromRequest(request, body);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;
    const roleError = await requirePromotionManager(db, user.id, companyId);
    if (roleError) return roleError;

    const parsed = parsePromotion(body);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const v = parsed.value;

    const id = await db.transaction(async (tx) => {
      const row = await tx.query<{ id: string }>(
        `INSERT INTO promotions (company_id, name, description, type, discount_value, buy_quantity, get_quantity,
                                 starts_at, ends_at, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [companyId, v.name, v.description, v.type, v.discount_value, v.buy_quantity, v.get_quantity,
         v.starts_at, v.ends_at, v.is_active, user.id]
      );
      await savePromotionProducts(tx, row.rows[0].id, companyId, v.productIds);
      return row.rows[0].id;
    });
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
