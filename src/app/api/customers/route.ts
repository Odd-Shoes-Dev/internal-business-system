import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/customers - List customers
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
      `SELECT COUNT(*)::text AS total FROM customers ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const dataResult = await db.query(
      `SELECT *
       FROM customers
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

// POST /api/customers - Create customer
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const { company_id, ...customerData } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, company_id);
    if (accessError) return accessError;

    // Validate required fields
    if (!customerData.name) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      );
    }

    // Check for duplicate email within this company
    if (customerData.email) {
      const existing = await db.query(
        'SELECT id FROM customers WHERE company_id = $1 AND email = $2 LIMIT 1',
        [company_id, customerData.email]
      );

      if (existing.rowCount > 0) {
        return NextResponse.json(
          { error: 'A customer with this email already exists' },
          { status: 400 }
        );
      }
    }

    // Generate customer number using database function
    const numberResult = await db.query<{ customer_number: string }>('SELECT generate_customer_number() AS customer_number');
    const customerNumber = numberResult.rows[0]?.customer_number;

    const data = await db.query(
      `INSERT INTO customers (
         company_id, customer_number, name, company_name, email, phone, tax_id,
         address_line1, address_line2, city, state, zip_code, country,
         payment_terms, credit_limit, notes, is_active
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13,
         $14, $15, $16, $17
       )
       RETURNING *`,
      [
        company_id,
        customerNumber,
        body.name,
        body.company_name || null,
        body.email || null,
        body.phone || null,
        body.tax_id || null,
        body.address_line1 || null,
        body.address_line2 || null,
        body.city || null,
        body.state || null,
        body.postal_code || null,
        body.country || 'USA',
        body.payment_terms || 30,
        body.credit_limit || 0,
        body.notes || null,
        body.is_active !== false,
      ]
    );

    return NextResponse.json({ data: data.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
