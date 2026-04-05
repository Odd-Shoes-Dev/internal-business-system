import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bank-reconciliation/session/[id] - Get reconciliation details
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const reconciliationResult = await db.query(
      `SELECT br.*,
              ba.id AS bank_account_ref_id,
              ba.name AS bank_account_name,
              ba.current_balance,
              ba.currency AS bank_account_currency,
              ba.company_id,
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

    // Get matched transactions
    const matchedTransactionsResult = await db.query(
      `SELECT bri.*, bt AS transaction
       FROM bank_reconciliation_items bri
       JOIN LATERAL (
         SELECT row_to_json(bt_row) AS bt
         FROM (
           SELECT * FROM bank_transactions WHERE id = bri.transaction_id
         ) bt_row
       ) trans ON true
       WHERE bri.reconciliation_id = $1`,
      [id]
    );

    // Get unmatched transactions for this bank account
    const unmatchedTransactionsResult = await db.query(
      `SELECT *
       FROM bank_transactions
       WHERE bank_account_id = $1
         AND is_reconciled = false
         AND transaction_date <= $2::date
       ORDER BY transaction_date DESC`,
      [reconciliation.bank_account_id, reconciliation.statement_date]
    );

    const data = {
      ...reconciliation,
      bank_account: reconciliation.bank_account_ref_id
        ? {
            id: reconciliation.bank_account_ref_id,
            account_name: reconciliation.bank_account_name,
            account_number: null,
            current_balance: reconciliation.current_balance,
            currency: reconciliation.bank_account_currency,
          }
        : null,
      completed_by_user: reconciliation.completed_by_user_id
        ? {
            id: reconciliation.completed_by_user_id,
            full_name: reconciliation.completed_by_user_full_name,
            email: reconciliation.completed_by_user_email,
          }
        : null,
      created_by_user: reconciliation.created_by_user_id
        ? {
            id: reconciliation.created_by_user_id,
            full_name: reconciliation.created_by_user_full_name,
            email: reconciliation.created_by_user_email,
          }
        : null,
      matched_transactions: matchedTransactionsResult.rows.map((row: any) => ({
        ...row,
        transaction: row.transaction,
      })),
      unmatched_transactions: unmatchedTransactionsResult.rows,
    };

    return NextResponse.json({
      data,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/bank-reconciliation/session/[id] - Update reconciliation
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    // Get existing reconciliation
    const existingResult = await db.query(
      `SELECT br.status, ba.company_id
       FROM bank_reconciliations br
       JOIN bank_accounts ba ON ba.id = br.bank_account_id
       WHERE br.id = $1
       LIMIT 1`,
      [id]
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (existing.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot update completed reconciliation' },
        { status: 400 }
      );
    }

    const disallowed = new Set(['id', 'bank_account_id', 'created_by', 'created_at', 'completed_by', 'completed_at']);
    const updates: string[] = [];
    const values: any[] = [id];

    for (const [key, value] of Object.entries(body || {})) {
      if (disallowed.has(key)) {
        continue;
      }
      values.push(value);
      updates.push(`${key} = $${values.length}`);
    }

    if (updates.length === 0) {
      const currentResult = await db.query('SELECT * FROM bank_reconciliations WHERE id = $1 LIMIT 1', [id]);
      return NextResponse.json({ data: currentResult.rows[0] });
    }

    const dataResult = await db.query(
      `UPDATE bank_reconciliations
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );

    const data = dataResult.rows[0];

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bank-reconciliation/session/[id] - Cancel reconciliation
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    // Get reconciliation
    const reconciliationResult = await db.query(
      `SELECT br.status, ba.company_id
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

    if (reconciliation.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot delete completed reconciliation' },
        { status: 400 }
      );
    }

    await db.transaction(async (tx) => {
      await tx.query('DELETE FROM bank_reconciliation_items WHERE reconciliation_id = $1', [id]);
      await tx.query('DELETE FROM bank_reconciliations WHERE id = $1', [id]);
    });

    return NextResponse.json({ message: 'Reconciliation cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
