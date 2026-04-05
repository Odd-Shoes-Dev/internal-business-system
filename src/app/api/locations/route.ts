import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export const dynamic = 'force-dynamic';

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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const params: any[] = [companyId];
    let whereSql = 'company_id = $1';
    if (type) {
      params.push(type);
      whereSql += ` AND type = $${params.length}`;
    }

    const result = await db.query(
      `SELECT *
       FROM locations
       WHERE ${whereSql}
       ORDER BY name ASC`,
      params
    );

    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching locations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      name,
      code,
      type,
      address,
      city,
      state,
      postal_code,
      country,
      phone,
      email,
      manager_name,
      is_active
    } = body;

    if (!name || !code || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await db.query(
      `INSERT INTO locations (
         company_id, name, code, type, address, city, state,
         postal_code, country, phone, email, manager_name, is_active,
         created_by
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13,
         $14
       )
       RETURNING *`,
      [
        companyId,
        name,
        code,
        type,
        address || null,
        city || null,
        state || null,
        postal_code || null,
        country || null,
        phone || null,
        email || null,
        manager_name || null,
        is_active ?? true,
        user.id,
      ]
    );

    const data = result.rows[0];

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
