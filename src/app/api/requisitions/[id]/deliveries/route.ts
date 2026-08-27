import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/requisitions/[id]/deliveries - List delivery forms for a requisition
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

    const reqResult = await db.query('SELECT * FROM stock_requisitions WHERE id = $1 LIMIT 1', [id]);
    const requisition = reqResult.rows[0];
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, requisition.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const result = await db.query(
      `SELECT d.*, creator.full_name AS created_by_name
       FROM stock_delivery_forms d
       LEFT JOIN user_profiles creator ON creator.id = d.created_by
       WHERE d.requisition_id = $1
       ORDER BY d.created_at ASC`,
      [id]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    console.error('Error fetching delivery forms:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/requisitions/[id]/deliveries - Process part (or all) of a requisition into a
// printable delivery form. Deducts stock immediately for each line delivered.
// If a line would take stock negative, the request is rejected with a `warnings` array
// unless `confirmed: true` is sent, letting the UI show a confirmation step first.
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
    const body = await request.json();
    const { delivery_date, delivered_by, received_by, notes, lines, confirmed } = body;

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'At least one item to deliver is required' }, { status: 400 });
    }
    for (const line of lines) {
      if (!line.requisition_line_id || !(Number(line.quantity_delivered) > 0)) {
        return NextResponse.json(
          { error: 'Each delivered item needs a requisition line and a quantity greater than 0' },
          { status: 400 }
        );
      }
    }

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
        { error: `Cannot process a ${requisition.status} requisition` },
        { status: 400 }
      );
    }

    const lineIds = lines.map((l: any) => l.requisition_line_id);
    const reqLinesResult = await db.query(
      `SELECT l.*, p.name AS product_name, p.quantity_on_hand
       FROM stock_requisition_lines l
       JOIN products p ON p.id = l.product_id
       WHERE l.id = ANY($1::uuid[]) AND l.requisition_id = $2`,
      [lineIds, id]
    );
    const reqLinesById = new Map(reqLinesResult.rows.map((l: any) => [l.id, l]));

    if (reqLinesById.size !== lineIds.length) {
      return NextResponse.json({ error: 'One or more items do not belong to this requisition' }, { status: 400 });
    }

    const warnings: string[] = [];
    for (const line of lines) {
      const reqLine: any = reqLinesById.get(line.requisition_line_id);
      const remaining = Number(reqLine.quantity_requested) - Number(reqLine.quantity_delivered);
      const qty = Number(line.quantity_delivered);
      if (qty > remaining) {
        return NextResponse.json(
          {
            error: `${reqLine.product_name}: cannot deliver ${qty}, only ${remaining} remains on this request`,
          },
          { status: 400 }
        );
      }
      if (qty > Number(reqLine.quantity_on_hand)) {
        warnings.push(
          `${reqLine.product_name}: only ${reqLine.quantity_on_hand} in stock, delivering ${qty} will take it negative`
        );
      }
    }

    if (warnings.length > 0 && !confirmed) {
      return NextResponse.json({ warnings }, { status: 409 });
    }

    const deliveryForm = await db.transaction(async (tx) => {
      const countResult = await tx.query(
        `SELECT COUNT(*)::int AS count FROM stock_delivery_forms WHERE requisition_id = $1`,
        [id]
      );
      const deliveryNumber = `${requisition.requisition_number}-D${countResult.rows[0].count + 1}`;

      const formResult = await tx.query(
        `INSERT INTO stock_delivery_forms (
           requisition_id, delivery_number, delivery_date, delivered_by, received_by, notes, created_by
         ) VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6, $7)
         RETURNING *`,
        [id, deliveryNumber, delivery_date || null, delivered_by || null, received_by || null, notes || null, user.id]
      );
      const form = formResult.rows[0];

      for (const line of lines) {
        const reqLine: any = reqLinesById.get(line.requisition_line_id);
        const qty = Number(line.quantity_delivered);

        await tx.query(
          `INSERT INTO stock_delivery_form_lines (delivery_form_id, requisition_line_id, product_id, quantity_delivered, remarks)
           VALUES ($1, $2, $3, $4, $5)`,
          [form.id, reqLine.id, reqLine.product_id, qty, line.remarks || null]
        );

        await tx.query(
          `UPDATE stock_requisition_lines
           SET quantity_delivered = quantity_delivered + $2, updated_at = NOW()
           WHERE id = $1`,
          [reqLine.id, qty]
        );

        await tx.query(
          `INSERT INTO inventory_movements (
             product_id, movement_type, quantity, reference_type, reference_id, notes, created_by
           ) VALUES ($1, 'requisition', $2, 'stock_delivery_form', $3, $4, $5)`,
          [reqLine.product_id, -qty, form.id, `Delivery ${deliveryNumber}`, user.id]
        );

        await tx.query(
          `UPDATE products SET quantity_on_hand = quantity_on_hand - $2, updated_at = NOW() WHERE id = $1`,
          [reqLine.product_id, qty]
        );
      }

      const totalsResult = await tx.query(
        `SELECT
           COALESCE(SUM(quantity_requested), 0) AS total_requested,
           COALESCE(SUM(quantity_delivered), 0) AS total_delivered
         FROM stock_requisition_lines WHERE requisition_id = $1`,
        [id]
      );
      const totals = totalsResult.rows[0];
      const isComplete = Number(totals.total_delivered) >= Number(totals.total_requested);
      const newStatus = isComplete ? 'completed' : 'partial';

      await tx.query(
        `UPDATE stock_requisitions
         SET status = $2::varchar, completed_at = CASE WHEN $2::varchar = 'completed' THEN NOW() ELSE completed_at END, updated_at = NOW()
         WHERE id = $1`,
        [id, newStatus]
      );

      return form;
    });

    return NextResponse.json({ data: deliveryForm }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating delivery form:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
