import { NextRequest, NextResponse } from 'next/server';
import {
  ADJUSTMENT_REASONS,
  adjustmentApprovalRequiredWithDb,
  approveStockAdjustmentWithDb,
  canApproveAdjustmentsWithDb,
  createStockAdjustmentWithDb,
  type AdjustmentReason,
} from '@/lib/inventory/adjustments';
import { StockError } from '@/lib/inventory/stock';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const productId = searchParams.get('product_id');
    const reason = searchParams.get('reason');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const where: string[] = ['p.company_id = $1'];
    const params: any[] = [companyId];

    if (productId) {
      params.push(productId);
      where.push(`m.product_id = $${params.length}`);
    }

    if (reason) {
      params.push(reason);
      where.push(`m.movement_type = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      where.push(`m.created_at >= $${params.length}::date`);
    }

    if (endDate) {
      params.push(endDate);
      where.push(`m.created_at <= ($${params.length}::date + INTERVAL '1 day' - INTERVAL '1 second')`);
    }

    const rowsResult = await db.query(
      `SELECT m.*,
              p.id AS product_ref_id,
              p.name AS product_name,
              p.sku AS product_sku,
              p.unit_of_measure AS product_unit
       FROM inventory_movements m
       JOIN products p ON p.id = m.product_id
       WHERE ${where.join(' AND ')}
       ORDER BY m.created_at DESC`,
      params
    );

    const data = rowsResult.rows.map((row: any) => ({
      ...row,
      adjustment_date: row.created_at,
      quantity_change: row.quantity,
      reason: row.movement_type,
      products: row.product_ref_id
        ? {
            id: row.product_ref_id,
            name: row.product_name,
            sku: row.product_sku,
            unit: row.product_unit,
          }
        : null,
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching inventory adjustments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const {
      product_id,
      adjustment_date,
      quantity_change,
      reason,
      reference_type,
      reference_id,
      notes,
    } = body;

    // Validate required fields
    if (!product_id || !adjustment_date || quantity_change === undefined || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const productResult = await db.query(
      'SELECT id, company_id, quantity_on_hand, cost_price FROM products WHERE id = $1 LIMIT 1',
      [product_id]
    );
    const product = productResult.rows[0];
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, product.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Older screens call this endpoint; it now files a stock adjustment (see /api/stock-adjustments),
    // applied straight away when approval is off or the requester may approve.
    const validReasons: string[] = [...ADJUSTMENT_REASONS];
    const mappedReason = (validReasons.includes(reason) ? reason : reason === 'write_off' ? 'damage' : 'count_correction') as AdjustmentReason;
    const approvalRequired = await adjustmentApprovalRequiredWithDb(db, product.company_id);
    const canApprove = await canApproveAdjustmentsWithDb(db, user.id, product.company_id);

    const adjustment = await db.transaction(async (tx) => {
      const adj = await createStockAdjustmentWithDb(tx, {
        companyId: product.company_id,
        productId: product_id,
        quantityChange: Number(quantity_change),
        reason: mappedReason,
        notes: notes || null,
        userId: user.id,
      });
      const approved = !approvalRequired || canApprove;
      if (approved) await approveStockAdjustmentWithDb(tx, adj.id, user.id);
      return { ...adj, status: approved ? 'approved' : 'pending' };
    });

    const data = {
      ...adjustment,
      adjustment_date,
      quantity_change: Number(quantity_change),
      reason: mappedReason,
      reference_type: reference_type || null,
      reference_id: reference_id || null,
    };

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    if (error instanceof StockError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error creating inventory adjustment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
