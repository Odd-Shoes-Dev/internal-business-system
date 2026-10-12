import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { acceptGoodsReceiptWithDb } from '@/lib/inventory/receiving';
import { StockError } from '@/lib/inventory/stock';

export const dynamic = 'force-dynamic';

const STATUSES = ['received', 'inspected', 'accepted', 'rejected', 'returned'];

// PATCH /api/goods-receipts/[id]/status — { status, inspection_notes? }
// 'accepted' brings the goods into stock and posts them to the ledger; it cannot be undone here.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { status, inspection_notes } = await request.json();
    const { id } = await params;
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const grResult = await db.query('SELECT id, company_id, status FROM goods_receipts WHERE id = $1 LIMIT 1', [id]);
    const gr = grResult.rows[0];
    if (!gr) {
      return NextResponse.json({ error: 'Goods receipt not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, gr.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (gr.status === 'accepted') {
      return NextResponse.json({ error: 'This receipt was already accepted into stock' }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      if (inspection_notes !== undefined) {
        await tx.query('UPDATE goods_receipts SET inspection_notes = $2, updated_at = NOW() WHERE id = $1', [id, inspection_notes]);
      }
      if (status === 'accepted') {
        await acceptGoodsReceiptWithDb(tx, id, user.id);
      } else {
        await tx.query('UPDATE goods_receipts SET status = $2, updated_at = NOW() WHERE id = $1', [id, status]);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof StockError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error updating goods receipt status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
