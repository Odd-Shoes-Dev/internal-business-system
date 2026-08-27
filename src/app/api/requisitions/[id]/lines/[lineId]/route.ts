import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

async function loadLine(db: any, id: string, lineId: string) {
  const reqResult = await db.query('SELECT * FROM stock_requisitions WHERE id = $1 LIMIT 1', [id]);
  const requisition = reqResult.rows[0];
  if (!requisition) return { requisition: null, line: null };

  const lineResult = await db.query(
    'SELECT * FROM stock_requisition_lines WHERE id = $1 AND requisition_id = $2 LIMIT 1',
    [lineId, id]
  );
  return { requisition, line: lineResult.rows[0] };
}

// PATCH /api/requisitions/[id]/lines/[lineId] - Change requested quantity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id, lineId } = await params;
    const body = await request.json();

    const { requisition, line } = await loadLine(db, id, lineId);
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }
    if (!line) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, requisition.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (requisition.status === 'completed' || requisition.status === 'closed') {
      return NextResponse.json(
        { error: `Cannot edit items on a ${requisition.status} requisition` },
        { status: 400 }
      );
    }

    const newQuantity = Number(body.quantity_requested);
    if (!(newQuantity > 0)) {
      return NextResponse.json({ error: 'quantity_requested must be greater than 0' }, { status: 400 });
    }
    if (newQuantity < Number(line.quantity_delivered)) {
      return NextResponse.json(
        {
          error: `Cannot set quantity below what has already been delivered (${line.quantity_delivered})`,
        },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx: any) => {
      const lineResult = await tx.query(
        `UPDATE stock_requisition_lines
         SET quantity_requested = $2, remarks = COALESCE($3, remarks), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [lineId, newQuantity, body.remarks ?? null]
      );

      const totalsResult = await tx.query(
        `SELECT
           COALESCE(SUM(quantity_requested), 0) AS total_requested,
           COALESCE(SUM(quantity_delivered), 0) AS total_delivered
         FROM stock_requisition_lines WHERE requisition_id = $1`,
        [id]
      );
      const totals = totalsResult.rows[0];
      const totalDelivered = Number(totals.total_delivered);
      const totalRequested = Number(totals.total_requested);
      const newStatus =
        totalRequested > 0 && totalDelivered >= totalRequested
          ? 'completed'
          : totalDelivered > 0
            ? 'partial'
            : 'open';

      await tx.query(
        `UPDATE stock_requisitions
         SET status = $2::varchar, completed_at = CASE WHEN $2::varchar = 'completed' THEN NOW() ELSE completed_at END, updated_at = NOW()
         WHERE id = $1`,
        [id, newStatus]
      );

      return lineResult.rows[0];
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Error updating requisition item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/requisitions/[id]/lines/[lineId] - Remove an item that has no deliveries yet
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id, lineId } = await params;

    const { requisition, line } = await loadLine(db, id, lineId);
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }
    if (!line) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, requisition.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (requisition.status === 'completed' || requisition.status === 'closed') {
      return NextResponse.json(
        { error: `Cannot remove items from a ${requisition.status} requisition` },
        { status: 400 }
      );
    }

    if (Number(line.quantity_delivered) > 0) {
      return NextResponse.json(
        { error: 'Cannot remove an item that already has delivered quantity — void the delivery form instead' },
        { status: 400 }
      );
    }

    await db.transaction(async (tx: any) => {
      await tx.query('DELETE FROM stock_requisition_lines WHERE id = $1', [lineId]);

      const totalsResult = await tx.query(
        `SELECT
           COALESCE(SUM(quantity_requested), 0) AS total_requested,
           COALESCE(SUM(quantity_delivered), 0) AS total_delivered
         FROM stock_requisition_lines WHERE requisition_id = $1`,
        [id]
      );
      const totals = totalsResult.rows[0];
      const totalDelivered = Number(totals.total_delivered);
      const totalRequested = Number(totals.total_requested);
      const newStatus =
        totalRequested > 0 && totalDelivered >= totalRequested
          ? 'completed'
          : totalDelivered > 0
            ? 'partial'
            : 'open';

      await tx.query(
        `UPDATE stock_requisitions
         SET status = $2::varchar, completed_at = CASE WHEN $2::varchar = 'completed' THEN NOW() ELSE completed_at END, updated_at = NOW()
         WHERE id = $1`,
        [id, newStatus]
      );
    });

    return NextResponse.json({ message: 'Item removed' });
  } catch (error: any) {
    console.error('Error removing requisition item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
