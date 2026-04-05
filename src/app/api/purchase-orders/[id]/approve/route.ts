import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/purchase-orders/[id]/approve - Approve purchase order
export async function POST(
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
      `SELECT po.*, v.name AS vendor_name
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

    if (po.status !== 'draft' && po.status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Only draft or pending approval POs can be approved' },
        { status: 400 }
      );
    }

    await db.query(
      `UPDATE purchase_orders
       SET status = 'approved',
           approved_by = $2,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [id, user.id]
    );

    const approvedResult = await db.query(
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
    const approvedPo = approvedResult.rows[0];

    const linesResult = await db.query(
      'SELECT * FROM purchase_order_lines WHERE purchase_order_id = $1 ORDER BY line_number ASC, created_at ASC',
      [id]
    );

    const data = {
      ...approvedPo,
      vendor: approvedPo.vendor_ref_id
        ? {
            id: approvedPo.vendor_ref_id,
            name: approvedPo.vendor_name,
            email: approvedPo.vendor_email,
          }
        : null,
      purchase_order_lines: linesResult.rows,
    };

    return NextResponse.json({
      message: 'Purchase order approved successfully',
      purchase_order: data,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
