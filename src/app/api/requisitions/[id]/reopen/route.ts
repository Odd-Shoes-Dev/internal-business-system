import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/requisitions/[id]/reopen - Reopen a requisition that was closed by mistake
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;

    const reqResult = await db.query('SELECT * FROM stock_requisitions WHERE id = $1 LIMIT 1', [id]);
    const requisition = reqResult.rows[0];
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, requisition.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (requisition.status !== 'closed') {
      return NextResponse.json({ error: 'Only a closed requisition can be reopened' }, { status: 400 });
    }

    const totalsResult = await db.query(
      `SELECT
         COALESCE(SUM(quantity_requested), 0) AS total_requested,
         COALESCE(SUM(quantity_delivered), 0) AS total_delivered
       FROM stock_requisition_lines WHERE requisition_id = $1`,
      [id]
    );
    const totals = totalsResult.rows[0];
    const newStatus = Number(totals.total_delivered) <= 0
      ? 'open'
      : Number(totals.total_delivered) >= Number(totals.total_requested)
        ? 'completed'
        : 'partial';

    const result = await db.query(
      `UPDATE stock_requisitions
       SET status = $2, closed_by = NULL, closed_at = NULL, close_reason = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, newStatus]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error reopening requisition:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
