import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bank-reconciliation/[bank_account_id] - Get reconciliations for bank account
export async function GET(request: NextRequest, context: { params: Promise<{ bank_account_id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { bank_account_id } = await context.params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const accountResult = await db.query(
      `SELECT id, name, current_balance, company_id
       FROM bank_accounts
       WHERE id = $1
       LIMIT 1`,
      [bank_account_id]
    );
    const account = accountResult.rows[0];
    if (!account) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, account.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const params: any[] = [bank_account_id];
    let whereSql = 'br.bank_account_id = $1';
    if (status) {
      params.push(status);
      whereSql += ` AND br.status = $${params.length}`;
    }

    const result = await db.query(
      `SELECT br.*,
              ba.id AS bank_account_ref_id,
              ba.name AS bank_account_name,
              ba.current_balance,
              upc.id AS completed_by_user_id,
              upc.full_name AS completed_by_user_full_name,
              upc.email AS completed_by_user_email,
              upcr.id AS created_by_user_id,
              upcr.full_name AS created_by_user_full_name,
              upcr.email AS created_by_user_email
       FROM bank_reconciliations br
       LEFT JOIN bank_accounts ba ON ba.id = br.bank_account_id
       LEFT JOIN user_profiles upc ON upc.id = br.completed_by
       LEFT JOIN user_profiles upcr ON upcr.id = br.created_by
       WHERE ${whereSql}
       ORDER BY br.reconciliation_date DESC`,
      params
    );

    const data = result.rows.map((row: any) => ({
      ...row,
      bank_account: row.bank_account_ref_id
        ? {
            id: row.bank_account_ref_id,
            account_name: row.bank_account_name,
            account_number: null,
            current_balance: row.current_balance,
          }
        : null,
      completed_by_user: row.completed_by_user_id
        ? {
            id: row.completed_by_user_id,
            full_name: row.completed_by_user_full_name,
            email: row.completed_by_user_email,
          }
        : null,
      created_by_user: row.created_by_user_id
        ? {
            id: row.created_by_user_id,
            full_name: row.created_by_user_full_name,
            email: row.created_by_user_email,
          }
        : null,
    }));

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bank-reconciliation/[bank_account_id] - Start new reconciliation
export async function POST(request: NextRequest, context: { params: Promise<{ bank_account_id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { bank_account_id } = await context.params;
    const body = await request.json();

    // Validate required fields
    if (!body.statement_date || !body.statement_ending_balance) {
      return NextResponse.json(
        { error: 'Missing required fields: statement_date, statement_ending_balance' },
        { status: 400 }
      );
    }

    // Check if bank account exists
    const bankAccountResult = await db.query(
      `SELECT id, current_balance, name, company_id
       FROM bank_accounts
       WHERE id = $1
       LIMIT 1`,
      [bank_account_id]
    );
    const bankAccount = bankAccountResult.rows[0];

    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, bankAccount.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Check for existing in_progress reconciliation
    const existingResult = await db.query(
      `SELECT id
       FROM bank_reconciliations
       WHERE bank_account_id = $1 AND status = 'in_progress'
       LIMIT 1`,
      [bank_account_id]
    );
    const existing = existingResult.rows[0];

    if (existing) {
      return NextResponse.json(
        { error: 'There is already an in-progress reconciliation for this account' },
        { status: 400 }
      );
    }

    // Get last reconciliation to get starting balance
    const lastReconResult = await db.query(
      `SELECT statement_ending_balance
       FROM bank_reconciliations
       WHERE bank_account_id = $1
         AND status = 'completed'
       ORDER BY reconciliation_date DESC
       LIMIT 1`,
      [bank_account_id]
    );
    const lastRecon = lastReconResult.rows[0];

    const startingBalance = lastRecon?.statement_ending_balance || 0;

    // Create reconciliation
    const reconciliationResult = await db.query(
      `INSERT INTO bank_reconciliations (
         bank_account_id, reconciliation_date, statement_starting_balance,
         statement_ending_balance, statement_date, book_balance, notes, created_by
       ) VALUES ($1, $2::date, $3, $4, $5::date, $6, $7, $8)
       RETURNING *`,
      [
        bank_account_id,
        body.reconciliation_date || new Date().toISOString().split('T')[0],
        startingBalance,
        body.statement_ending_balance,
        body.statement_date,
        bankAccount.current_balance,
        body.notes || null,
        user.id,
      ]
    );

    const row = reconciliationResult.rows[0];
    const reconciliation = {
      ...row,
      bank_account: {
        id: bankAccount.id,
        account_name: bankAccount.name,
        account_number: null,
        current_balance: bankAccount.current_balance,
      },
    };

    return NextResponse.json({ data: reconciliation }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
