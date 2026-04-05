import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/bank-transactions/reconcile - Bulk update reconciliation status
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const companyId = body.company_id;
    const transactionIds = Array.isArray(body.transaction_ids) ? body.transaction_ids : [];
    const reconciled = body.is_reconciled !== false;

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    if (!transactionIds.length) {
      return NextResponse.json({ error: 'transaction_ids is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const result = await db.query(
      `UPDATE bank_transactions bt
       SET is_reconciled = $1,
           updated_at = NOW()
       FROM bank_accounts ba
       WHERE bt.bank_account_id = ba.id
         AND ba.company_id = $2
         AND bt.id = ANY($3::uuid[])
       RETURNING bt.id`,
      [reconciled, companyId, transactionIds]
    );

    return NextResponse.json({
      message: reconciled ? 'Transactions reconciled successfully' : 'Transactions unreconciled successfully',
      updated_count: result.rowCount || 0,
      updated_ids: result.rows.map((row: any) => row.id),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
