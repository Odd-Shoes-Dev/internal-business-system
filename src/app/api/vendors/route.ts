import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/vendors - List vendors
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const { searchParams } = new URL(request.url);

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;
    
    const search = searchParams.get('search');
    const active = searchParams.get('active');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const where: string[] = ['company_id = $1'];
    const params: any[] = [companyId];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR company_name ILIKE $${params.length})`);
    }

    if (active === 'true' || active === 'false') {
      params.push(active === 'true');
      where.push(`is_active = $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countResult = await db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM vendors ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const dataResult = await db.query(
      `SELECT *
       FROM vendors
       ${whereSql}
       ORDER BY name
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const count = Number(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/vendors - Create vendor
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const body = await request.json();

    const { company_id, ...vendorData } = body;

    // Validate required fields
    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    if (!vendorData.name) {
      return NextResponse.json(
        { error: 'Vendor name is required' },
        { status: 400 }
      );
    }

    const accessError = await requireCompanyAccess(user.id, company_id);
    if (accessError) return accessError;

    // Generate vendor number using database function
    const numberResult = await db.query<{ vendor_number: string }>('SELECT generate_vendor_number() AS vendor_number');
    const vendorNumber = numberResult.rows[0]?.vendor_number;

    const data = await db.query(
      `INSERT INTO vendors (
         company_id, vendor_number, name, company_name, email, phone, tax_id,
         address_line1, address_line2, city, state, zip_code, country,
         payment_terms, default_expense_account_id, notes, is_active
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13,
         $14, $15, $16, $17
       )
       RETURNING *`,
      [
        company_id,
        vendorNumber,
        vendorData.name,
        vendorData.company_name || null,
        vendorData.email || null,
        vendorData.phone || null,
        vendorData.tax_id || null,
        vendorData.address_line1 || null,
        vendorData.address_line2 || null,
        vendorData.city || null,
        vendorData.state || null,
        vendorData.postal_code || null,
        vendorData.country || 'USA',
        vendorData.payment_terms || 30,
        vendorData.default_expense_account_id || null,
        vendorData.notes || null,
        vendorData.is_active !== false,
      ]
    );

    return NextResponse.json({ data: data.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
