import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

async function getCompanyColumnInfo(db: any) {
  const result = await db.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'asset_categories'
         AND column_name = 'company_id'
     ) AS exists`
  );
  return !!result.rows[0]?.exists;
}

async function getDepreciationRateColumnInfo(db: any) {
  const result = await db.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'asset_categories'
         AND column_name = 'depreciation_rate'
     ) AS exists`
  );
  return !!result.rows[0]?.exists;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      depreciation_method,
      depreciation_rate,
      useful_life_years,
      company_id,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const supportsCompanyId = await getCompanyColumnInfo(db);
    const existingResult = await db.query<any>(
      'SELECT id, company_id FROM asset_categories WHERE id = $1 LIMIT 1',
      [id]
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const scopedCompanyId = existing.company_id || company_id || null;
    if (supportsCompanyId && scopedCompanyId) {
      const companyAccessError = await requireCompanyAccess(user.id, scopedCompanyId);
      if (companyAccessError) {
        return companyAccessError;
      }
    }

    const supportsDepreciationRate = await getDepreciationRateColumnInfo(db);

    let updateResult;
    if (supportsDepreciationRate) {
      updateResult = await db.query(
        `UPDATE asset_categories
         SET name = $2,
             description = $3,
             depreciation_method = $4,
             depreciation_rate = $5,
             useful_life_years = $6
         WHERE id = $1
         RETURNING *`,
        [
          id,
          name,
          description || null,
          depreciation_method || null,
          depreciation_rate || null,
          useful_life_years || null,
        ]
      );
    } else {
      updateResult = await db.query(
        `UPDATE asset_categories
         SET name = $2,
             description = $3,
             depreciation_method = $4,
             useful_life_years = $5
         WHERE id = $1
         RETURNING *`,
        [
          id,
          name,
          description || null,
          depreciation_method || null,
          useful_life_years || null,
        ]
      );
    }

    return NextResponse.json(updateResult.rows[0]);
  } catch (error: any) {
    console.error('Error updating asset category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;
    const supportsCompanyId = await getCompanyColumnInfo(db);

    const existingResult = await db.query<any>(
      'SELECT id, company_id FROM asset_categories WHERE id = $1 LIMIT 1',
      [id]
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    if (supportsCompanyId && existing.company_id) {
      const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
      if (companyAccessError) {
        return companyAccessError;
      }
    }

    await db.query('DELETE FROM asset_categories WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting asset category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
