import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bank-reconciliation/session/[id]/complete - Complete reconciliation
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    // Get reconciliation with current totals
    const reconciliationResult = await db.query(
      `SELECT br.*, ba.name AS bank_account_name, ba.company_id
       FROM bank_reconciliations br
       JOIN bank_accounts ba ON ba.id = br.bank_account_id
       WHERE br.id = $1
       LIMIT 1`,
      [id]
    );
    const reconciliation = reconciliationResult.rows[0];

    if (!reconciliation) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, reconciliation.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (reconciliation.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Reconciliation is not in progress' },
        { status: 400 }
      );
    }

    // Check if reconciliation balances
    const tolerance = body.tolerance || 0.01; // Allow 1 cent difference by default
    if (Math.abs(reconciliation.difference) > tolerance) {
      return NextResponse.json(
        {
          error: 'Reconciliation does not balance',
          difference: reconciliation.difference,
          book_balance: reconciliation.book_balance,
          adjusted_bank_balance: reconciliation.adjusted_bank_balance,
        },
        { status: 400 }
      );
    }

    // Complete the reconciliation (trigger will mark transactions as reconciled)
    await db.query(
      `UPDATE bank_reconciliations
       SET status = 'completed',
           completed_by = $2,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [id, user.id]
    );

    const dataResult = await db.query(
      `SELECT br.*,
              ba.id AS bank_account_ref_id,
              ba.name AS bank_account_name,
              up.id AS completed_by_user_id,
              up.full_name AS completed_by_user_full_name,
              up.email AS completed_by_user_email
       FROM bank_reconciliations br
       LEFT JOIN bank_accounts ba ON ba.id = br.bank_account_id
       LEFT JOIN user_profiles up ON up.id = br.completed_by
       WHERE br.id = $1
       LIMIT 1`,
      [id]
    );

    const row = dataResult.rows[0];
    const data = {
      ...row,
      bank_account: row.bank_account_ref_id
        ? {
            id: row.bank_account_ref_id,
            account_name: row.bank_account_name,
            account_number: null,
          }
        : null,
      completed_by_user: row.completed_by_user_id
        ? {
            id: row.completed_by_user_id,
            full_name: row.completed_by_user_full_name,
            email: row.completed_by_user_email,
          }
        : null,
    };

    // Get count of reconciled transactions
    const countResult = await db.query(
      'SELECT COUNT(*)::int AS total FROM bank_reconciliation_items WHERE reconciliation_id = $1',
      [id]
    );
    const count = Number(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      data,
      message: `Reconciliation completed successfully. ${count} transactions reconciled.`,
      reconciled_count: count,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
