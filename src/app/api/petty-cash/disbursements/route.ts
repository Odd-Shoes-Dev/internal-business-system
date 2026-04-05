import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/petty-cash/disbursements - List petty cash disbursements
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const cash_account_id = searchParams.get('cash_account_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: string[] = ['ba.company_id = $1'];
    const params: any[] = [companyId];

    if (cash_account_id) {
      params.push(cash_account_id);
      where.push(`pcd.cash_account_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      where.push(`pcd.status = $${params.length}`);
    }

    const offset = (page - 1) * limit;
    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const listResult = await db.query(
      `SELECT pcd.*,
              json_build_object('id', ba.id, 'account_name', ba.name) AS cash_account,
              CASE
                WHEN up.id IS NULL THEN NULL
                ELSE json_build_object('id', up.id, 'full_name', up.full_name)
              END AS approved_by_user
       FROM petty_cash_disbursements pcd
       LEFT JOIN bank_accounts ba ON ba.id = pcd.cash_account_id
       LEFT JOIN user_profiles up ON up.id = pcd.approved_by
       WHERE ${where.join(' AND ')}
       ORDER BY pcd.disbursement_date DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM petty_cash_disbursements pcd
       LEFT JOIN bank_accounts ba ON ba.id = pcd.cash_account_id
       WHERE ${where.join(' AND ')}`,
      countParams
    );

    const total = countResult.rows[0]?.total || 0;

    return NextResponse.json({
      data: listResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/petty-cash/disbursements - Create petty cash disbursement
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    if (!body.company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, body.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Validate required fields
    if (!body.cash_account_id || !body.amount || !body.category || !body.recipient || !body.disbursement_date) {
      return NextResponse.json(
        { error: 'Missing required fields: cash_account_id, amount, category, recipient, disbursement_date' },
        { status: 400 }
      );
    }

    const accountResult = await db.query(
      `SELECT id, name, company_id
       FROM bank_accounts
       WHERE id = $1
       LIMIT 1`,
      [body.cash_account_id]
    );
    const cashAccount = accountResult.rows[0];

    if (!cashAccount) {
      return NextResponse.json({ error: 'Cash account not found' }, { status: 404 });
    }

    if (cashAccount.company_id !== body.company_id) {
      return NextResponse.json({ error: 'Cash account does not belong to the selected company' }, { status: 400 });
    }

    // Generate disbursement number
    const lastDisbursementResult = await db.query(
      `SELECT disbursement_number
       FROM petty_cash_disbursements
       WHERE disbursement_number LIKE 'PC-%'
       ORDER BY created_at DESC
       LIMIT 1`
    );
    const lastDisbursement = lastDisbursementResult.rows[0];

    let nextNumber = 1;
    if (lastDisbursement?.disbursement_number) {
      const match = lastDisbursement.disbursement_number.match(/PC-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const disbursement_number = `PC-${String(nextNumber).padStart(6, '0')}`;

    const createResult = await db.query(
      `INSERT INTO petty_cash_disbursements (
         company_id,
         disbursement_number,
         cash_account_id,
         disbursement_date,
         amount,
         category,
         description,
         recipient,
         receipt_number,
         status,
         notes,
         created_by
       ) VALUES (
         $1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12
       )
       RETURNING *`,
      [
        body.company_id,
        disbursement_number,
        body.cash_account_id,
        body.disbursement_date,
        Number(body.amount),
        body.category,
        body.description || '',
        body.recipient,
        body.receipt_number || null,
        body.status || 'pending',
        body.notes || null,
        user.id,
      ]
    );

    const created = createResult.rows[0];
    return NextResponse.json(
      {
        ...created,
        cash_account: {
          id: cashAccount.id,
          account_name: cashAccount.name,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
