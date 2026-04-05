import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/bank-accounts - List bank accounts
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
    
    const active = searchParams.get('active');

    const params: any[] = [companyId];
    let whereSql = 'WHERE company_id = $1';
    if (active === 'true' || active === 'false') {
      params.push(active === 'true');
      whereSql += ` AND is_active = $${params.length}`;
    }

    const data = await db.query(
      `SELECT *
       FROM bank_accounts
       ${whereSql}
       ORDER BY name`,
      params
    );

    return NextResponse.json({ data: data.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bank-accounts - Create bank account
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const body = await request.json();

    // Multi-tenant: Validate and verify company_id
    if (!body.company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, body.company_id);
    if (accessError) return accessError;

    // Validate required fields
    if (!body.name || !body.bank_name) {
      return NextResponse.json(
        { error: 'Account name and bank name are required' },
        { status: 400 }
      );
    }

    // If this is marked as primary, unset other primary accounts
    if (body.is_primary) {
      await db.query(
        'UPDATE bank_accounts SET is_primary = FALSE WHERE company_id = $1 AND is_primary = TRUE',
        [body.company_id]
      );
    }

    const data = await db.query(
      `INSERT INTO bank_accounts (
         company_id, name, bank_name, account_number_encrypted, routing_number,
         account_type, currency, is_primary, is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        body.company_id,
        body.name,
        body.bank_name,
        null,
        body.routing_number || null,
        body.account_type || 'checking',
        body.currency || 'USD',
        body.is_primary || false,
        body.is_active !== false,
      ]
    );

    return NextResponse.json({ data: data.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
