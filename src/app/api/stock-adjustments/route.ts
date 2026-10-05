import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import {
  adjustmentApprovalRequiredWithDb,
  approveStockAdjustmentWithDb,
  canApproveAdjustmentsWithDb,
  createStockAdjustmentWithDb,
  type AdjustmentReason,
} from '@/lib/inventory/adjustments';
import { StockError } from '@/lib/inventory/stock';

// GET /api/stock-adjustments?company_id=&status=pending — adjustments, newest first
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const status = new URL(request.url).searchParams.get('status');
    const params: any[] = [companyId];
    let statusSql = '';
    if (status) {
      params.push(status);
      statusSql = `AND a.status = $${params.length}`;
    }

    const result = await db.query(
      `SELECT a.*, a.quantity_change::float AS quantity_change, a.total_cost::float AS total_cost,
              p.name AS product_name, p.sku, p.unit_of_measure,
              ru.full_name AS requested_by_name, au.full_name AS approved_by_name
       FROM stock_adjustments a
       JOIN products p ON p.id = a.product_id
       LEFT JOIN app_users ru ON ru.id = a.requested_by
       LEFT JOIN app_users au ON au.id = a.approved_by
       WHERE a.company_id = $1 ${statusSql}
       ORDER BY a.created_at DESC
       LIMIT 200`,
      params
    );

    return NextResponse.json({
      data: result.rows,
      can_approve: await canApproveAdjustmentsWithDb(db, user.id, companyId),
      approval_required: await adjustmentApprovalRequiredWithDb(db, companyId),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/stock-adjustments — { company_id, lines: [{ product_id, quantity_change, reason, notes? }] }
// Lines wait for approval unless the company turned approval off, or the requester can approve
// and sends approve: true.
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const companyId = getCompanyIdFromRequest(request, body);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const lines: Array<{ product_id: string; quantity_change: number; reason: AdjustmentReason; notes?: string }> =
      Array.isArray(body.lines) ? body.lines : [body];
    if (!lines.length) return NextResponse.json({ error: 'Add at least one product' }, { status: 400 });

    const approvalRequired = await adjustmentApprovalRequiredWithDb(db, companyId);
    const canApprove = await canApproveAdjustmentsWithDb(db, user.id, companyId);
    const approveNow = !approvalRequired || (body.approve === true && canApprove);

    const created = await db.transaction(async (tx) => {
      const rows = [];
      for (const line of lines) {
        const adj = await createStockAdjustmentWithDb(tx, {
          companyId,
          productId: line.product_id,
          quantityChange: Number(line.quantity_change),
          reason: line.reason,
          notes: line.notes || body.notes || null,
          userId: user.id,
        });
        if (approveNow) await approveStockAdjustmentWithDb(tx, adj.id, user.id);
        rows.push({ ...adj, status: approveNow ? 'approved' : 'pending' });
      }
      return rows;
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: any) {
    if (error instanceof StockError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
