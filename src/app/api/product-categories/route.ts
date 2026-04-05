import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const result = await db.query(
      `SELECT *
       FROM product_categories
       WHERE company_id = $1
       ORDER BY name ASC`,
      [companyId]
    );

    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching product categories:', error);
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
    const { name, description } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const result = await db.query(
      `INSERT INTO product_categories (
         company_id, name, description, created_by
       ) VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [companyId, name, description || null, user.id]
    );

    const data = result.rows[0];

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
