import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/requisitions/[id]/lines - Add a missing item to an open/partial requisition
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
    const { product_id, quantity_requested, remarks } = body;

    if (!product_id || !(Number(quantity_requested) > 0)) {
      return NextResponse.json(
        { error: 'A product and a quantity requested greater than 0 are required' },
        { status: 400 }
      );
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
        { error: `Cannot add items to a ${requisition.status} requisition` },
        { status: 400 }
      );
    }

    const result = await db.query(
      `INSERT INTO stock_requisition_lines (requisition_id, product_id, quantity_requested, remarks)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, product_id, Number(quantity_requested), remarks || null]
    );

    // Adding an item to a partially-completed requisition reopens it as partial
    if (requisition.status !== 'open') {
      await db.query(
        `UPDATE stock_requisitions SET status = 'partial', updated_at = NOW() WHERE id = $1`,
        [id]
      );
    }

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding requisition item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
