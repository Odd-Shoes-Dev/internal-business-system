import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import {
  canApproveAdjustmentsWithDb,
  rejectStockAdjustmentWithDb,
} from '@/lib/inventory/adjustments';
import { StockError } from '@/lib/inventory/stock';

// POST /api/stock-adjustments/[id]/reject — owners, admins and accountants only
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await params;
    const existing = await db.query<{ company_id: string }>('SELECT company_id FROM stock_adjustments WHERE id = $1', [id]);
    const row = existing.rows[0];
    if (!row) return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });

    const accessError = await requireCompanyAccess(user.id, row.company_id);
    if (accessError) return accessError;
    if (!(await canApproveAdjustmentsWithDb(db, user.id, row.company_id))) {
      return NextResponse.json({ error: 'Only an owner, admin or accountant can review stock adjustments' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    await db.transaction(async (tx) => {
      await rejectStockAdjustmentWithDb(tx, id, user.id, body.reason ?? null);
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof StockError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
