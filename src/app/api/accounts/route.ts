import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/accounts - List accounts
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
    
    const type = searchParams.get('type');
    const active = searchParams.get('active');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;

    const where: string[] = ['(company_id = $1 OR company_id IS NULL)'];
    const params: any[] = [companyId];

    if (type) {
      params.push(type);
      where.push(`account_type = $${params.length}`);
    }

    if (active === 'true' || active === 'false') {
      params.push(active === 'true');
      where.push(`is_active = $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countResult = await db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM accounts ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const dataResult = await db.query(
      `SELECT id, code, name, account_type, account_subtype, is_active, normal_balance
       FROM accounts
       ${whereSql}
       ORDER BY code
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

// POST /api/accounts - Create account
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const body = await request.json();

    const { company_id, ...accountData } = body;

    // Multi-tenant: Validate company_id
    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Validate required fields
    if (!accountData.code || !accountData.name || !accountData.account_type) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name, account_type' },
        { status: 400 }
      );
    }

    const accessError = await requireCompanyAccess(user.id, company_id);
    if (accessError) return accessError;

    // Check if account code already exists
    const existing = await db.query('SELECT id FROM accounts WHERE code = $1 LIMIT 1', [accountData.code]);

    if (existing.rowCount > 0) {
      return NextResponse.json(
        { error: 'An account with this code already exists' },
        { status: 400 }
      );
    }

    const data = await db.query(
      `INSERT INTO accounts (
         company_id, code, name, description, account_type, account_subtype,
         parent_id, currency, is_active, normal_balance
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        company_id,
        accountData.code,
        accountData.name,
        accountData.description || null,
        accountData.account_type,
        accountData.account_subtype || null,
        accountData.parent_id || null,
        accountData.currency || 'USD',
        accountData.is_active !== false,
        accountData.normal_balance || 'debit',
      ]
    );

    return NextResponse.json({ data: data.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}