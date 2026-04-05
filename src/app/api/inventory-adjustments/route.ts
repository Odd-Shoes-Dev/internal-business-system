import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const productId = searchParams.get('product_id');
    const reason = searchParams.get('reason');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const where: string[] = ['p.company_id = $1'];
    const params: any[] = [companyId];

    if (productId) {
      params.push(productId);
      where.push(`m.product_id = $${params.length}`);
    }

    if (reason) {
      params.push(reason);
      where.push(`m.movement_type = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      where.push(`m.created_at >= $${params.length}::date`);
    }

    if (endDate) {
      params.push(endDate);
      where.push(`m.created_at <= ($${params.length}::date + INTERVAL '1 day' - INTERVAL '1 second')`);
    }

    const rowsResult = await db.query(
      `SELECT m.*,
              p.id AS product_ref_id,
              p.name AS product_name,
              p.sku AS product_sku,
              p.unit_of_measure AS product_unit
       FROM inventory_movements m
       JOIN products p ON p.id = m.product_id
       WHERE ${where.join(' AND ')}
       ORDER BY m.created_at DESC`,
      params
    );

    const data = rowsResult.rows.map((row: any) => ({
      ...row,
      adjustment_date: row.created_at,
      quantity_change: row.quantity,
      reason: row.movement_type,
      products: row.product_ref_id
        ? {
            id: row.product_ref_id,
            name: row.product_name,
            sku: row.product_sku,
            unit: row.product_unit,
          }
        : null,
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching inventory adjustments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const {
      product_id,
      adjustment_date,
      quantity_change,
      reason,
      reference_type,
      reference_id,
      notes,
    } = body;

    // Validate required fields
    if (!product_id || !adjustment_date || quantity_change === undefined || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const productResult = await db.query(
      'SELECT id, company_id, quantity_on_hand, cost_price FROM products WHERE id = $1 LIMIT 1',
      [product_id]
    );
    const product = productResult.rows[0];
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, product.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const adjustment = await db.transaction(async (tx) => {
      const movementResult = await tx.query(
        `INSERT INTO inventory_movements (
           product_id, movement_type, quantity, unit_cost, total_cost,
           reference_type, reference_id, notes, created_by, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
         RETURNING *`,
        [
          product_id,
          reason,
          Number(quantity_change),
          Number(body.unit_cost ?? product.cost_price ?? 0),
          Number(quantity_change) * Number(body.unit_cost ?? product.cost_price ?? 0),
          reference_type || null,
          reference_id || null,
          notes || null,
          user.id,
          adjustment_date,
        ]
      );

      const updatedStock = Number(product.quantity_on_hand || 0) + Number(quantity_change || 0);

      await tx.query(
        `UPDATE products
         SET quantity_on_hand = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [product_id, updatedStock]
      );

      return movementResult.rows[0];
    });

    const data = {
      ...adjustment,
      adjustment_date: adjustment.created_at,
      quantity_change: adjustment.quantity,
      reason: adjustment.movement_type,
    };

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating inventory adjustment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
