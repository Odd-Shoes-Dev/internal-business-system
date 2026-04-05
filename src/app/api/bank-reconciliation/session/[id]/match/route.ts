import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bank-reconciliation/session/[id]/match - Match/unmatch transaction
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    // Validate transaction_id
    if (!body.transaction_id) {
      return NextResponse.json(
        { error: 'Missing required field: transaction_id' },
        { status: 400 }
      );
    }

    // Get reconciliation
    const reconciliationResult = await db.query(
      `SELECT br.status, br.bank_account_id, ba.company_id
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
        { error: 'Can only match transactions in in_progress reconciliations' },
        { status: 400 }
      );
    }

    // Verify transaction belongs to the bank account
    const transactionResult = await db.query(
      `SELECT bank_account_id, is_reconciled
       FROM bank_transactions
       WHERE id = $1
       LIMIT 1`,
      [body.transaction_id]
    );
    const transaction = transactionResult.rows[0];

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.bank_account_id !== reconciliation.bank_account_id) {
      return NextResponse.json(
        { error: 'Transaction does not belong to this bank account' },
        { status: 400 }
      );
    }

    if (transaction.is_reconciled) {
      return NextResponse.json(
        { error: 'Transaction is already reconciled in a completed reconciliation' },
        { status: 400 }
      );
    }

    // Check if match action
    const action = body.action || 'match'; // match or unmatch

    if (action === 'match') {
      try {
        const dataResult = await db.query(
          `INSERT INTO bank_reconciliation_items (
             reconciliation_id, transaction_id, cleared_date, matched_by
           ) VALUES ($1, $2, $3::date, $4)
           RETURNING *`,
          [id, body.transaction_id, body.cleared_date || new Date().toISOString().split('T')[0], user.id]
        );

        return NextResponse.json({ data: dataResult.rows[0], message: 'Transaction matched successfully' });
      } catch (error: any) {
        if (String(error?.code) === '23505' || String(error?.message || '').toLowerCase().includes('duplicate')) {
          return NextResponse.json(
            { error: 'Transaction is already matched in this reconciliation' },
            { status: 400 }
          );
        }
        throw error;
      }
    } else if (action === 'unmatch') {
      // Remove from reconciliation items
      await db.query(
        `DELETE FROM bank_reconciliation_items
         WHERE reconciliation_id = $1
           AND transaction_id = $2`,
        [id, body.transaction_id]
      );

      return NextResponse.json({ message: 'Transaction unmatched successfully' });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "match" or "unmatch"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
