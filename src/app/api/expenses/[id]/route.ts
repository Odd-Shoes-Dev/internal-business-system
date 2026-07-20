import { NextRequest, NextResponse } from 'next/server';
import { createExpenseJournalEntryWithDb } from '@/lib/accounting/provider-accounting';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/expenses/[id] - Get expense details
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const result = await db.query(
      `SELECT e.*,
              v.id AS vendor_ref_id,
              v.name AS vendor_name,
              v.company_name AS vendor_company_name,
              ea.id AS expense_account_ref_id,
              ea.name AS expense_account_name,
              ea.code AS expense_account_code,
              pa.id AS payment_account_ref_id,
              pa.name AS payment_account_name,
              pa.code AS payment_account_code,
              ba.id AS bank_account_ref_id,
              ba.name AS bank_account_name,
              c.id AS customer_ref_id,
              c.name AS customer_name,
              je.id AS journal_entry_ref_id,
              je.entry_number AS journal_entry_number,
              je.entry_date AS journal_entry_date,
              up.id AS created_by_user_id,
              up.email AS created_by_user_email,
              up.full_name AS created_by_user_full_name
       FROM expenses e
       LEFT JOIN vendors v ON v.id = e.vendor_id
       LEFT JOIN accounts ea ON ea.id = e.expense_account_id
       LEFT JOIN accounts pa ON pa.id = e.payment_account_id
       LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
       LEFT JOIN customers c ON c.id = e.customer_id
       LEFT JOIN journal_entries je ON je.id = e.journal_entry_id
       LEFT JOIN app_users up ON up.id = e.created_by
       WHERE e.id = $1
       LIMIT 1`,
      [params.id]
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, row.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const data = {
      ...row,
      vendor: row.vendor_ref_id ? { id: row.vendor_ref_id, name: row.vendor_name, company_name: row.vendor_company_name } : null,
      expense_account: row.expense_account_ref_id
        ? { id: row.expense_account_ref_id, name: row.expense_account_name, code: row.expense_account_code }
        : null,
      payment_account: row.payment_account_ref_id
        ? { id: row.payment_account_ref_id, name: row.payment_account_name, code: row.payment_account_code }
        : null,
      bank_account: row.bank_account_ref_id
        ? { id: row.bank_account_ref_id, name: row.bank_account_name }
        : null,
      customer: row.customer_ref_id ? { id: row.customer_ref_id, name: row.customer_name } : null,
      journal_entry: row.journal_entry_ref_id
        ? { id: row.journal_entry_ref_id, entry_number: row.journal_entry_number, entry_date: row.journal_entry_date }
        : null,
      created_by_user: row.created_by_user_id
        ? { id: row.created_by_user_id, email: row.created_by_user_email, full_name: row.created_by_user_full_name }
        : null,
    };

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/expenses/[id] - Update expense
export async function PATCH(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    const existingResult = await db.query('SELECT id, company_id, status, journal_entry_id FROM expenses WHERE id = $1 LIMIT 1', [params.id]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (existing.status === 'paid' && body.status !== 'paid') {
      return NextResponse.json({ error: 'Cannot edit paid expenses. Void the expense first.' }, { status: 400 });
    }

    const ALLOWED_FIELDS = [
      'expense_date', 'vendor_id', 'expense_account_id', 'payment_account_id',
      'amount', 'tax_amount', 'currency', 'description', 'category', 'department',
      'payment_method', 'bank_account_id', 'receipt_url', 'is_billable', 'customer_id',
      'status', 'reference', 'notes',
    ];

    const updateData: any = {};
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    if (updateData.amount !== undefined || updateData.tax_amount !== undefined) {
      const amount = Number(updateData.amount ?? existing.amount ?? 0);
      const taxAmount = Number(updateData.tax_amount ?? existing.tax_amount ?? 0);
      updateData.total = amount + taxAmount;
    }

    const fields = Object.keys(updateData);
    if (fields.length === 0) {
      return NextResponse.json({ data: existing });
    }

    const expense = await db.transaction(async (tx) => {
      const setSql = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = fields.map((f) => updateData[f]);

      const updateResult = await tx.query(
        `UPDATE expenses
         SET ${setSql}, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [params.id, ...values]
      );

      const updated = updateResult.rows[0];

      if (['approved', 'paid'].includes(body.status) && !['approved', 'paid'].includes(existing.status) && !existing.journal_entry_id) {
        const accountResult = await tx.query('SELECT code FROM accounts WHERE id = $1 AND company_id = $2 LIMIT 1', [updated.expense_account_id, existing.company_id]);
        const accountCode = accountResult.rows[0]?.code;

        if (accountCode) {
          const journalResult = await createExpenseJournalEntryWithDb(
            tx,
            {
              id: updated.id,
              expense_number: updated.expense_number,
              expense_date: updated.expense_date,
              amount: updated.total,
              account_code: accountCode,
              description: updated.description || 'Expense',
              bank_account_id: updated.bank_account_id,
              company_id: existing.company_id,
              currency: existing.currency || 'USD',
            },
            user.id
          );

          if (journalResult.journalEntryId) {
            await tx.query('UPDATE expenses SET journal_entry_id = $2 WHERE id = $1', [params.id, journalResult.journalEntryId]);
            updated.journal_entry_id = journalResult.journalEntryId;
          } else if (!journalResult.success) {
            throw new Error(`Expense updated but journal entry failed: ${journalResult.error}`);
          }
        }
      }

      return updated;
    });

    return NextResponse.json({ data: expense });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/expenses/[id] - Delete expense
export async function DELETE(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const existingResult = await db.query('SELECT id, company_id, status, journal_entry_id FROM expenses WHERE id = $1 LIMIT 1', [params.id]);
    const expense = existingResult.rows[0];

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, expense.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (expense.status === 'paid' || expense.status === 'approved') {
      return NextResponse.json(
        { error: 'Cannot delete paid or approved expenses. Only pending/rejected expenses can be deleted.' },
        { status: 400 }
      );
    }

    if (expense.journal_entry_id) {
      return NextResponse.json({ error: 'Cannot delete expense with journal entry. Contact administrator.' }, { status: 400 });
    }

    await db.query('DELETE FROM expenses WHERE id = $1', [params.id]);

    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
