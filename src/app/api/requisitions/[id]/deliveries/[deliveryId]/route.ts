import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// PATCH /api/requisitions/[id]/deliveries/[deliveryId] - Edit non-stock fields on an
// active delivery form (delivered_by, received_by, delivery_date, notes). Quantities
// cannot be changed here — void the delivery and create a new one for that.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deliveryId: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id, deliveryId } = await params;
    const body = await request.json();

    const reqResult = await db.query('SELECT * FROM stock_requisitions WHERE id = $1 LIMIT 1', [id]);
    const requisition = reqResult.rows[0];
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, requisition.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const formResult = await db.query(
      'SELECT * FROM stock_delivery_forms WHERE id = $1 AND requisition_id = $2 LIMIT 1',
      [deliveryId, id]
    );
    const form = formResult.rows[0];
    if (!form) {
      return NextResponse.json({ error: 'Delivery form not found' }, { status: 404 });
    }
    if (form.status === 'voided') {
      return NextResponse.json({ error: 'Cannot edit a voided delivery form' }, { status: 400 });
    }

    const result = await db.query(
      `UPDATE stock_delivery_forms
       SET delivery_date = COALESCE($2, delivery_date),
           delivered_by = $3,
           received_by = $4,
           notes = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        deliveryId,
        body.delivery_date ?? null,
        body.delivered_by?.trim() || null,
        body.received_by?.trim() || null,
        body.notes?.trim() || null,
      ]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating delivery form:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
