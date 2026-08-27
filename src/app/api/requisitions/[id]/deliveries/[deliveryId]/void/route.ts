import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/requisitions/[id]/deliveries/[deliveryId]/void
// Reverses the stock effect of a delivery form and its contribution to delivered
// quantities on the requisition, but keeps the delivery form record (marked voided).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deliveryId: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id, deliveryId } = await params;
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

    const formResult = await db.query(
      'SELECT * FROM stock_delivery_forms WHERE id = $1 AND requisition_id = $2 LIMIT 1',
      [deliveryId, id]
    );
    const form = formResult.rows[0];
    if (!form) {
      return NextResponse.json({ error: 'Delivery form not found' }, { status: 404 });
    }
    if (form.status === 'voided') {
      return NextResponse.json({ error: 'This delivery form is already voided' }, { status: 400 });
    }

    const linesResult = await db.query(
      'SELECT * FROM stock_delivery_form_lines WHERE delivery_form_id = $1',
      [deliveryId]
    );

    await db.transaction(async (tx) => {
      for (const line of linesResult.rows) {
        const qty = Number(line.quantity_delivered);

        await tx.query(
          `UPDATE stock_requisition_lines
           SET quantity_delivered = quantity_delivered - $2, updated_at = NOW()
           WHERE id = $1`,
          [line.requisition_line_id, qty]
        );

        await tx.query(
          `INSERT INTO inventory_movements (
             product_id, movement_type, quantity, reference_type, reference_id, notes, created_by
           ) VALUES ($1, 'requisition', $2, 'stock_delivery_form_void', $3, $4, $5)`,
          [line.product_id, qty, form.id, `Void of delivery ${form.delivery_number}`, user.id]
        );

        await tx.query(
          `UPDATE products SET quantity_on_hand = quantity_on_hand + $2, updated_at = NOW() WHERE id = $1`,
          [line.product_id, qty]
        );
      }

      await tx.query(
        `UPDATE stock_delivery_forms
         SET status = 'voided', voided_by = $2, voided_at = NOW(), void_reason = $3
         WHERE id = $1`,
        [deliveryId, user.id, body.void_reason || null]
      );

      const totalsResult = await tx.query(
        `SELECT
           COALESCE(SUM(quantity_requested), 0) AS total_requested,
           COALESCE(SUM(quantity_delivered), 0) AS total_delivered
         FROM stock_requisition_lines WHERE requisition_id = $1`,
        [id]
      );
      const totals = totalsResult.rows[0];
      let newStatus = requisition.status;
      if (requisition.status === 'completed' || requisition.status === 'partial') {
        newStatus = Number(totals.total_delivered) <= 0
          ? 'open'
          : Number(totals.total_delivered) >= Number(totals.total_requested)
            ? 'completed'
            : 'partial';
      }

      await tx.query(
        `UPDATE stock_requisitions
         SET status = $2::varchar, completed_at = CASE WHEN $2::varchar = 'completed' THEN completed_at ELSE NULL END, updated_at = NOW()
         WHERE id = $1`,
        [id, newStatus]
      );
    });

    return NextResponse.json({ message: 'Delivery form voided and stock reversed' });
  } catch (error: any) {
    console.error('Error voiding delivery form:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
