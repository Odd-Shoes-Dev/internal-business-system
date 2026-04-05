import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/bank-transactions/[id] - Get transaction detail
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const rowResult = await db.query<any>(
      `SELECT bt.*, ba.company_id, ba.name AS bank_account_name, ba.bank_name AS bank_account_bank_name
       FROM bank_transactions bt
       JOIN bank_accounts ba ON ba.id = bt.bank_account_id
       WHERE bt.id = $1
       LIMIT 1`,
      [id]
    );

    const row = rowResult.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, row.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const data = {
      ...row,
      bank_accounts: {
        id: row.bank_account_id,
        name: row.bank_account_name,
        bank_name: row.bank_account_bank_name,
      },
    };

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bank-transactions/[id] - Delete transaction
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const rowResult = await db.query<any>(
      `SELECT bt.id, ba.company_id
       FROM bank_transactions bt
       JOIN bank_accounts ba ON ba.id = bt.bank_account_id
       WHERE bt.id = $1
       LIMIT 1`,
      [id]
    );

    const row = rowResult.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, row.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    await db.query('DELETE FROM bank_transactions WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Transaction deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
