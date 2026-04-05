import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const headerResult = await db.query(
      `SELECT st.*,
              il.id AS location_ref_id,
              il.name AS location_name,
              il.type AS location_type,
              up.full_name AS counted_by_full_name
       FROM stock_takes st
       LEFT JOIN inventory_locations il ON il.id = st.location_id
       LEFT JOIN user_profiles up ON up.id = st.counted_by
       WHERE st.id = $1
       LIMIT 1`,
      [id]
    );

    const stockTake = headerResult.rows[0];
    if (!stockTake) {
      return NextResponse.json({ error: 'Stock take not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, stockTake.company_id);
    if (accessError) {
      return accessError;
    }

    const linesResult = await db.query(
      `SELECT stl.*, p.id AS product_ref_id, p.name AS product_name, p.sku AS product_sku, p.unit_of_measure
       FROM stock_take_lines stl
       LEFT JOIN products p ON p.id = stl.product_id
       WHERE stl.stock_take_id = $1
       ORDER BY stl.created_at ASC`,
      [id]
    );

    return NextResponse.json({
      data: {
        ...stockTake,
        inventory_locations: stockTake.location_ref_id
          ? {
              id: stockTake.location_ref_id,
              name: stockTake.location_name,
              type: stockTake.location_type,
            }
          : null,
        user_profiles: stockTake.counted_by_full_name
          ? { full_name: stockTake.counted_by_full_name }
          : null,
      },
      lines: linesResult.rows.map((line: any) => ({
        ...line,
        products: line.product_ref_id
          ? {
              id: line.product_ref_id,
              name: line.product_name,
              sku: line.product_sku,
              unit: line.unit_of_measure,
            }
          : null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    const existingResult = await db.query('SELECT id, company_id FROM stock_takes WHERE id = $1 LIMIT 1', [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Stock take not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, existing.company_id);
    if (accessError) {
      return accessError;
    }

    const result = await db.query(
      `UPDATE stock_takes
       SET status = COALESCE($2, status),
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, body.status ?? null, body.notes ?? null]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
