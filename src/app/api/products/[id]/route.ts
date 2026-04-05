import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const result = await db.query(
      `SELECT p.*, pc.name AS category_name
       FROM products p
       LEFT JOIN product_categories pc ON pc.id = p.category_id
       WHERE p.id = $1
       LIMIT 1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, row.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const movementResult = await db.query(
      `SELECT *
       FROM inventory_movements
       WHERE product_id = $1
       ORDER BY movement_date DESC, created_at DESC
       LIMIT 50`,
      [id]
    );

    return NextResponse.json({
      data: {
        ...row,
        product_categories: row.category_name ? { name: row.category_name } : null,
      },
      movements: movementResult.rows,
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

    const currentResult = await db.query('SELECT id, company_id FROM products WHERE id = $1 LIMIT 1', [id]);
    const current = currentResult.rows[0];
    if (!current) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, current.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const fieldMap: Record<string, string> = {
      name: 'name',
      sku: 'sku',
      barcode: 'barcode',
      description: 'description',
      category_id: 'category_id',
      unit_of_measure: 'unit_of_measure',
      unit_price: 'unit_price',
      cost: 'cost_price',
      quantity_in_stock: 'quantity_on_hand',
      reorder_point: 'reorder_point',
      manufacturer: 'manufacturer',
      brand: 'brand',
      model_number: 'model_number',
      weight: 'weight',
      dimensions: 'dimensions',
      is_active: 'is_active',
      track_inventory: 'track_inventory',
    };

    const updates: string[] = [];
    const values: any[] = [id];

    for (const [key, column] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        values.push(body[key]);
        updates.push(`${column} = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updatedResult = await db.query(
      `UPDATE products
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );

    return NextResponse.json({ data: updatedResult.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const currentResult = await db.query('SELECT id, company_id FROM products WHERE id = $1 LIMIT 1', [id]);
    const current = currentResult.rows[0];
    if (!current) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, current.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    await db.query('DELETE FROM products WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
