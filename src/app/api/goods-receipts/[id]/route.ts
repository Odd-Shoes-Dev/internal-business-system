import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/goods-receipts/[id] - Get goods receipt details
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const receiptResult = await db.query(
      `SELECT gr.*,
              po.id AS po_ref_id,
              po.po_number,
              v.id AS vendor_ref_id,
              v.name AS vendor_name,
              v.email AS vendor_email,
              up.id AS received_by_user_id,
              up.full_name AS received_by_full_name
       FROM goods_receipts gr
       LEFT JOIN purchase_orders po ON po.id = gr.purchase_order_id
       LEFT JOIN vendors v ON v.id = po.vendor_id
       LEFT JOIN user_profiles up ON up.id = gr.created_by
       WHERE gr.id = $1
       LIMIT 1`,
      [id]
    );

    const row = receiptResult.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Goods receipt not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, row.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const linesResult = await db.query(
      `SELECT grl.*,
              pol.id AS po_line_ref_id,
              pol.description,
              pol.quantity,
              pol.unit_price,
              pol.unit
       FROM goods_receipt_lines grl
       LEFT JOIN purchase_order_lines pol ON pol.id = grl.po_line_id
       WHERE grl.goods_receipt_id = $1
       ORDER BY grl.created_at ASC`,
      [id]
    );

    const data = {
      ...row,
      gr_number: row.receipt_number,
      purchase_order: row.po_ref_id
        ? {
            id: row.po_ref_id,
            po_number: row.po_number,
            vendor: row.vendor_ref_id
              ? { id: row.vendor_ref_id, name: row.vendor_name, email: row.vendor_email }
              : null,
          }
        : null,
      goods_receipt_lines: linesResult.rows.map((line: any) => ({
        ...line,
        purchase_order_line: line.po_line_ref_id
          ? {
              id: line.po_line_ref_id,
              description: line.description,
              quantity: line.quantity,
              unit_price: line.unit_price,
              unit: line.unit,
            }
          : null,
      })),
      received_by_user: row.received_by_user_id
        ? {
            id: row.received_by_user_id,
            full_name: row.received_by_full_name,
          }
        : null,
    };

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/goods-receipts/[id] - Update goods receipt status
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    const existingResult = await db.query('SELECT id, company_id FROM goods_receipts WHERE id = $1 LIMIT 1', [id]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Goods receipt not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const updatedResult = await db.query(
      `UPDATE goods_receipts
       SET status = COALESCE($2, status),
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, body.status ?? null, body.notes ?? null]
    );

    const updated = updatedResult.rows[0];

    const poResult = await db.query('SELECT id, po_number FROM purchase_orders WHERE id = $1 LIMIT 1', [updated.purchase_order_id]);

    const data = {
      ...updated,
      gr_number: updated.receipt_number,
      purchase_order: poResult.rows[0] || null,
    };

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
