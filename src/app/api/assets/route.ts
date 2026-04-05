import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

async function resolveCompanyId(db: any, userId: string, request: NextRequest, bodyCompanyId?: string | null) {
  const requestedCompanyId = bodyCompanyId || getCompanyIdFromRequest(request);
  if (requestedCompanyId) {
    return requestedCompanyId;
  }

  const userCompany = await db.query(
    `SELECT company_id
     FROM user_companies
     WHERE user_id = $1
     ORDER BY is_primary DESC, joined_at ASC
     LIMIT 1`,
    [userId]
  );

  return userCompany.rows[0]?.company_id || null;
}

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const companyId = await resolveCompanyId(db, user.id, request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const params: any[] = [companyId];
    const where: string[] = ['fa.company_id = $1'];

    if (status) {
      params.push(status);
      where.push(`fa.status = $${params.length}`);
    }

    const result = await db.query(
      `SELECT fa.*, ac.name AS asset_category_name
       FROM fixed_assets fa
       LEFT JOIN asset_categories ac ON ac.id = fa.category_id
       WHERE ${where.join(' AND ')}
       ORDER BY fa.created_at DESC`,
      params
    );

    const data = result.rows.map((row: any) => ({
      ...row,
      asset_categories: row.asset_category_name
        ? {
            name: row.asset_category_name,
          }
        : null,
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in assets GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const companyId = await resolveCompanyId(db, user.id, request, body.company_id);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const {
      name,
      description,
      category_id,
      asset_number,
      serial_number,
      purchase_date,
      purchase_price,
      residual_value,
      useful_life_months,
      depreciation_start_date,
      depreciation_method,
      location,
      notes,
      vendor_id,
      currency,
    } = body;

    if (!name || !purchase_date || !useful_life_months) {
      return NextResponse.json({ error: 'Missing required fields: name, purchase_date, useful_life_months' }, { status: 400 });
    }

    const generatedNumber = asset_number || `ASSET-${Date.now().toString().slice(-6)}`;
    const purchasePrice = Number(purchase_price) || 0;
    const salvageValue = Number(residual_value) || 0;

    const insertResult = await db.query(
      `INSERT INTO fixed_assets (
         company_id, name, description, category_id, asset_number, serial_number,
         purchase_date, purchase_price, residual_value, depreciation_start_date,
         useful_life_months, depreciation_method, accumulated_depreciation,
         location, vendor_id, notes, status, currency, created_by
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7::date, $8, $9, $10::date,
         $11, $12, 0,
         $13, $14, $15, 'active', $16, $17
       )
       RETURNING *`,
      [
        companyId,
        name,
        description || null,
        category_id || null,
        generatedNumber,
        serial_number || null,
        purchase_date,
        purchasePrice,
        salvageValue,
        depreciation_start_date || purchase_date,
        Number(useful_life_months),
        depreciation_method || 'straight_line',
        location || null,
        vendor_id || null,
        notes || null,
        currency || 'USD',
        user.id,
      ]
    );

    return NextResponse.json(insertResult.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error in assets POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

