import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/assets/[id] - Get single asset
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const result = await db.query<any>(
      `SELECT fa.*, ac.name AS asset_category_name, v.name AS vendor_name
       FROM fixed_assets fa
       LEFT JOIN asset_categories ac ON ac.id = fa.category_id
       LEFT JOIN vendors v ON v.id = fa.vendor_id
       WHERE fa.id = $1
       LIMIT 1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, row.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const data = {
      ...row,
      asset_categories: row.asset_category_name
        ? {
            name: row.asset_category_name,
          }
        : null,
      vendors: row.vendor_name
        ? {
            name: row.vendor_name,
          }
        : null,
    };

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/assets/[id] - Update asset
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const existingResult = await db.query<any>('SELECT id, company_id FROM fixed_assets WHERE id = $1 LIMIT 1', [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const body = await request.json();
    const {
      name,
      description,
      asset_number,
      serial_number,
      purchase_date,
      purchase_price,
      residual_value,
      useful_life_months,
      depreciation_method,
      depreciation_start_date,
      location,
      notes,
    } = body;

    const updateResult = await db.query<any>(
      `UPDATE fixed_assets
       SET name = $2,
           description = $3,
           asset_number = $4,
           serial_number = $5,
           purchase_date = $6::date,
           purchase_price = $7,
           residual_value = $8,
           useful_life_months = $9,
           depreciation_method = $10,
           depreciation_start_date = $11::date,
           location = $12,
           notes = $13,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        name,
        description || null,
        asset_number,
        serial_number || null,
        purchase_date,
        Number(purchase_price),
        Number(residual_value),
        Number(useful_life_months),
        depreciation_method,
        depreciation_start_date,
        location || null,
        notes || null,
      ]
    );

    return NextResponse.json(updateResult.rows[0]);
  } catch (error: any) {
    console.error('Error in assets PUT:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/assets/[id] - Delete asset
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const existingResult = await db.query<any>('SELECT id, company_id FROM fixed_assets WHERE id = $1 LIMIT 1', [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    await db.query('DELETE FROM fixed_assets WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Asset deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
