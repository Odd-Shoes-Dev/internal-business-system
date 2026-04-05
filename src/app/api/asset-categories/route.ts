import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    const hasCompanyColumn = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_name = 'asset_categories'
           AND column_name = 'company_id'
       ) AS exists`
    );

    let result;
    if (hasCompanyColumn.rows[0]?.exists && companyId) {
      result = await db.query(
        'SELECT * FROM asset_categories WHERE company_id = $1 ORDER BY name ASC',
        [companyId]
      );
    } else {
      result = await db.query('SELECT * FROM asset_categories ORDER BY name ASC');
    }

    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching asset categories:', error);
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

    const hasCompanyColumn = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_name = 'asset_categories'
           AND column_name = 'company_id'
       ) AS exists`
    );

    const hasDepreciationRateColumn = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_name = 'asset_categories'
           AND column_name = 'depreciation_rate'
       ) AS exists`
    );

    const supportsDepreciationRate = !!hasDepreciationRateColumn.rows[0]?.exists;

    let insertResult;
    if (hasCompanyColumn.rows[0]?.exists && company_id) {
      if (supportsDepreciationRate) {
        insertResult = await db.query(
          `INSERT INTO asset_categories (
             company_id, name, description, depreciation_method, depreciation_rate, useful_life_years
           ) VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            company_id,
            name,
            description || null,
            depreciation_method || null,
            depreciation_rate || null,
            useful_life_years || null,
          ]
        );
      } else {
        insertResult = await db.query(
          `INSERT INTO asset_categories (
             company_id, name, description, depreciation_method, useful_life_years
           ) VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [company_id, name, description || null, depreciation_method || null, useful_life_years || null]
        );
      }
    } else {
      if (supportsDepreciationRate) {
        insertResult = await db.query(
          `INSERT INTO asset_categories (
             name, description, depreciation_method, depreciation_rate, useful_life_years
           ) VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            name,
            description || null,
            depreciation_method || null,
            depreciation_rate || null,
            useful_life_years || null,
          ]
        );
      } else {
        insertResult = await db.query(
          `INSERT INTO asset_categories (
             name, description, depreciation_method, useful_life_years
           ) VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [name, description || null, depreciation_method || null, useful_life_years || null]
        );
      }
    }

    return NextResponse.json(insertResult.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating asset category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

