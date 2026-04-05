import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/purchase-orders/[id] - Get PO details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const poResult = await db.query(
      `SELECT po.*,
              v.id AS vendor_ref_id,
              v.name AS vendor_name,
              v.email AS vendor_email,
              v.phone AS vendor_phone,
              v.address_line1,
              v.city,
              v.country
       FROM purchase_orders po
       LEFT JOIN vendors v ON v.id = po.vendor_id
       WHERE po.id = $1
       LIMIT 1`,
      [id]
    );
    const po = poResult.rows[0];

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, po.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const linesResult = await db.query(
      `SELECT *
       FROM purchase_order_lines
       WHERE purchase_order_id = $1
       ORDER BY line_number ASC, created_at ASC`,
      [id]
    );

    const receiptsResult = await db.query(
      `SELECT *
       FROM goods_receipts
       WHERE purchase_order_id = $1
       ORDER BY received_date DESC, created_at DESC`,
      [id]
    );

    const data = {
      ...po,
      vendor: po.vendor_ref_id
        ? {
            id: po.vendor_ref_id,
            name: po.vendor_name,
            email: po.vendor_email,
            phone: po.vendor_phone,
            address_line1: po.address_line1,
            city: po.city,
            country: po.country,
          }
        : null,
      purchase_order_lines: linesResult.rows,
      goods_receipts: receiptsResult.rows,
    };

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/purchase-orders/[id] - Update PO
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    const existingResult = await db.query(
      'SELECT id, company_id, status, vendor_id FROM purchase_orders WHERE id = $1 LIMIT 1',
      [id]
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (existing.status === 'received' || existing.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot edit received or closed purchase orders' },
        { status: 400 }
      );
    }

    const allowedFields = ['po_date', 'expected_delivery_date', 'status', 'notes', 'currency', 'exchange_rate', 'tax_rate'];
    const updates: string[] = [];
    const params: any[] = [id];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        params.push(body[field]);
        updates.push(`${field} = $${params.length}`);
      }
    }

    if (updates.length > 0) {
      await db.query(
        `UPDATE purchase_orders
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $1`,
        params
      );
    }

    const poResult = await db.query(
      `SELECT po.*,
              v.id AS vendor_ref_id,
              v.name AS vendor_name,
              v.email AS vendor_email
       FROM purchase_orders po
       LEFT JOIN vendors v ON v.id = po.vendor_id
       WHERE po.id = $1
       LIMIT 1`,
      [id]
    );

    const linesResult = await db.query(
      'SELECT * FROM purchase_order_lines WHERE purchase_order_id = $1 ORDER BY line_number ASC, created_at ASC',
      [id]
    );

    const data = {
      ...poResult.rows[0],
      vendor: poResult.rows[0]?.vendor_ref_id
        ? {
            id: poResult.rows[0].vendor_ref_id,
            name: poResult.rows[0].vendor_name,
            email: poResult.rows[0].vendor_email,
          }
        : null,
      purchase_order_lines: linesResult.rows,
    };

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/purchase-orders/[id] - Cancel PO
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const poResult = await db.query('SELECT id, company_id, status FROM purchase_orders WHERE id = $1 LIMIT 1', [id]);
    const po = poResult.rows[0];

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, po.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (po.status === 'received' || po.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot cancel received or closed purchase orders. Mark as void instead.' },
        { status: 400 }
      );
    }

    await db.query(
      `UPDATE purchase_orders
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ message: 'Purchase order cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
