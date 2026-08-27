import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/requisitions/[id]/close - Close a requisition without fully delivering it.
// Nothing already delivered is reversed; this just stops further delivery forms
// from being created against the remaining balance.
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
    const body = await request.json().catch(() => ({}));

    const reqResult = await db.query('SELECT * FROM stock_requisitions WHERE id = $1 LIMIT 1', [id]);
    const requisition = reqResult.rows[0];
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, requisition.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (requisition.status === 'completed' || requisition.status === 'closed') {
      return NextResponse.json(
        { error: `Requisition is already ${requisition.status}` },
        { status: 400 }
      );
    }

    const result = await db.query(
      `UPDATE stock_requisitions
       SET status = 'closed', closed_by = $2, closed_at = NOW(), close_reason = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, user.id, body.close_reason || null]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error closing requisition:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
