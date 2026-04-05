import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// PATCH /api/product-categories/[id] - Update product category
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    const existing = await db.query<{ company_id: string }>(
      'SELECT company_id FROM product_categories WHERE id = $1 LIMIT 1',
      [id]
    );
    const current = existing.rows[0];

    if (!current) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, current.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (!body.name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const updated = await db.query(
      `UPDATE product_categories
       SET name = $2,
           description = $3,
           parent_id = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, body.name, body.description || null, body.parent_id || null]
    );

    return NextResponse.json(updated.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/product-categories/[id] - Delete product category
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const existing = await db.query<{ company_id: string }>(
      'SELECT company_id FROM product_categories WHERE id = $1 LIMIT 1',
      [id]
    );
    const current = existing.rows[0];

    if (!current) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, current.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    await db.query('DELETE FROM product_categories WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
