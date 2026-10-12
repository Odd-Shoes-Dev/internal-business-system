import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { parsePromotion, requirePromotionManager, savePromotionProducts } from '../shared';

async function load(id: string) {
  const { db, user, errorResponse } = await requireSessionUser();
  if (errorResponse || !user) return { error: errorResponse! };
  const row = (await db.query<{ company_id: string }>('SELECT company_id FROM promotions WHERE id = $1', [id])).rows[0];
  if (!row) return { error: NextResponse.json({ error: 'Promotion not found' }, { status: 404 }) };
  const accessError = await requireCompanyAccess(user.id, row.company_id);
  if (accessError) return { error: accessError };
  const roleError = await requirePromotionManager(db, user.id, row.company_id);
  if (roleError) return { error: roleError };
  return { db, user, companyId: row.company_id };
}

// PUT /api/promotions/[id] — replace the promotion (same body as create)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await load(id);
    if ('error' in ctx) return ctx.error;
    const parsed = parsePromotion(await request.json());
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const v = parsed.value;

    await ctx.db.transaction(async (tx) => {
      await tx.query(
        `UPDATE promotions SET name = $2, description = $3, type = $4, discount_value = $5, buy_quantity = $6,
           get_quantity = $7, starts_at = $8, ends_at = $9, is_active = $10, updated_at = NOW()
         WHERE id = $1`,
        [id, v.name, v.description, v.type, v.discount_value, v.buy_quantity, v.get_quantity, v.starts_at, v.ends_at, v.is_active]
      );
      await savePromotionProducts(tx, id, ctx.companyId, v.productIds);
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/promotions/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await load(id);
    if ('error' in ctx) return ctx.error;
    await ctx.db.query('DELETE FROM promotions WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
