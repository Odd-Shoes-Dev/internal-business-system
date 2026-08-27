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

    const result = await db.query(
      `UPDATE stock_requisition_lines
       SET quantity_requested = $2, remarks = COALESCE($3, remarks), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [lineId, newQuantity, body.remarks ?? null]
    );

    // Raising the requested quantity on an otherwise-complete line reopens the requisition
    if (requisition.status === 'partial' || requisition.status === 'open') {
      // status recompute happens implicitly; nothing else to do here since it wasn't completed
    }

    return NextResponse.json({ data: result.rows[0] });
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

    await db.query('DELETE FROM stock_requisition_lines WHERE id = $1', [lineId]);

    return NextResponse.json({ message: 'Item removed' });
  } catch (error: any) {
    console.error('Error removing requisition item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
