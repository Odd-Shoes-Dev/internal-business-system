import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';
import {
  adjustmentApprovalRequiredWithDb,
  approveStockAdjustmentWithDb,
  canApproveAdjustmentsWithDb,
  createStockAdjustmentWithDb,
  type AdjustmentReason,
} from '@/lib/inventory/adjustments';
import { StockError } from '@/lib/inventory/stock';

// POST /api/inventory/[id]/adjust - Adjust inventory quantity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    if (!body.adjustment_type || body.quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: adjustment_type, quantity' },
        { status: 400 }
      );
    }

    const itemResult = await db.query('SELECT * FROM products WHERE id = $1 LIMIT 1', [id]);
    const item = itemResult.rows[0];

    if (!item) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, item.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Older API: map the adjustment type onto a stock adjustment (see /api/stock-adjustments)
    const qty = Number(body.quantity || 0);
    const onHand = Number(item.quantity_on_hand || 0);
    const mapping: Record<string, { change: number; reason: AdjustmentReason }> = {
      add: { change: qty, reason: 'found' },
      receive: { change: qty, reason: 'found' },
      return: { change: qty, reason: 'found' },
      remove: { change: -qty, reason: 'other' },
      sell: { change: -qty, reason: 'other' },
      damage: { change: -qty, reason: 'damage' },
      shrinkage: { change: -qty, reason: 'theft' },
      adjustment: { change: qty - onHand, reason: 'count_correction' },
    };
    const mapped = mapping[body.adjustment_type];
    if (!mapped) {
      return NextResponse.json({ error: 'Invalid adjustment type' }, { status: 400 });
    }
    if (!mapped.change) {
      return NextResponse.json({ error: 'Quantity does not change' }, { status: 400 });
    }

    const approvalRequired = await adjustmentApprovalRequiredWithDb(db, item.company_id);
    const approved = !approvalRequired || (await canApproveAdjustmentsWithDb(db, user.id, item.company_id));
    try {
      const adjustment = await db.transaction(async (tx) => {
        const adj = await createStockAdjustmentWithDb(tx, {
          companyId: item.company_id,
          productId: id,
          quantityChange: mapped.change,
          reason: mapped.reason,
          notes: body.notes || null,
          userId: user.id,
        });
        if (approved) await approveStockAdjustmentWithDb(tx, adj.id, user.id);
        return { ...adj, status: approved ? 'approved' : 'pending' };
      });
      const updated = await db.query('SELECT * FROM products WHERE id = $1', [id]);
      return NextResponse.json({ data: { item: updated.rows[0], adjustment } });
    } catch (error: any) {
      if (error instanceof StockError) return NextResponse.json({ error: error.message }, { status: 400 });
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/inventory/[id]/movements - Get movement history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const productResult = await db.query('SELECT id, company_id FROM products WHERE id = $1 LIMIT 1', [id]);
    const product = productResult.rows[0];
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, product.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const countResult = await db.query('SELECT COUNT(*)::int AS total FROM inventory_movements WHERE product_id = $1', [id]);

    const rowsResult = await db.query(
      `SELECT *
       FROM inventory_movements
       WHERE product_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    const total = Number(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      data: rowsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
