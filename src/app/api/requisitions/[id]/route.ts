import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/requisitions/[id] - Requisition detail with lines and delivery forms
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;

    const reqResult = await db.query(
      `SELECT r.*,
              creator.full_name AS created_by_name,
              closer.full_name AS closed_by_name
       FROM stock_requisitions r
       LEFT JOIN user_profiles creator ON creator.id = r.created_by
       LEFT JOIN user_profiles closer ON closer.id = r.closed_by
       WHERE r.id = $1 LIMIT 1`,
      [id]
    );
    const requisition = reqResult.rows[0];
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, requisition.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const linesResult = await db.query(
      `SELECT l.*, p.name AS product_name, p.sku, p.unit_of_measure, p.quantity_on_hand
       FROM stock_requisition_lines l
       JOIN products p ON p.id = l.product_id
       WHERE l.requisition_id = $1
       ORDER BY l.created_at ASC`,
      [id]
    );

    const deliveriesResult = await db.query(
      `SELECT d.*, creator.full_name AS created_by_name, voider.full_name AS voided_by_name
       FROM stock_delivery_forms d
       LEFT JOIN user_profiles creator ON creator.id = d.created_by
       LEFT JOIN user_profiles voider ON voider.id = d.voided_by
       WHERE d.requisition_id = $1
       ORDER BY d.created_at ASC`,
      [id]
    );

    const deliveryLinesResult = await db.query(
      `SELECT dl.*, p.name AS product_name, p.unit_of_measure,
              rl.quantity_requested, rl.quantity_delivered AS quantity_delivered_total
       FROM stock_delivery_form_lines dl
       JOIN products p ON p.id = dl.product_id
       JOIN stock_requisition_lines rl ON rl.id = dl.requisition_line_id
       WHERE dl.delivery_form_id = ANY($1::uuid[])`,
      [deliveriesResult.rows.map((d: any) => d.id)]
    );

    const deliveries = deliveriesResult.rows.map((d: any) => ({
      ...d,
      lines: deliveryLinesResult.rows.filter((dl: any) => dl.delivery_form_id === d.id),
    }));

    return NextResponse.json({
      data: { ...requisition, lines: linesResult.rows, deliveries },
    });
  } catch (error: any) {
    console.error('Error fetching requisition:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/requisitions/[id] - Edit header fields (open/partial only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;
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

    if (requisition.status === 'completed' || requisition.status === 'closed') {
      return NextResponse.json(
        { error: `Cannot edit a ${requisition.status} requisition` },
        { status: 400 }
      );
    }

    const result = await db.query(
      `UPDATE stock_requisitions
       SET client_name = COALESCE($2, client_name),
           delivery_location = COALESCE($3, delivery_location),
           notes = COALESCE($4, notes),
           request_date = COALESCE($5, request_date),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, body.client_name ?? null, body.delivery_location ?? null, body.notes ?? null, body.request_date ?? null]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating requisition:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/requisitions/[id] - Remove a requisition that has no delivery forms yet
export async function DELETE(
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

    const deliveryCount = await db.query(
      `SELECT COUNT(*)::int AS count FROM stock_delivery_forms WHERE requisition_id = $1`,
      [id]
    );
    if (deliveryCount.rows[0].count > 0) {
      return NextResponse.json(
        { error: 'This requisition already has delivery forms — close it instead of deleting' },
        { status: 400 }
      );
    }

    await db.query('DELETE FROM stock_requisitions WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Requisition deleted' });
  } catch (error: any) {
    console.error('Error deleting requisition:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
