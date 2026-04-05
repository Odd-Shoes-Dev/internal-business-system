import { NextRequest, NextResponse } from 'next/server';
import { createExpenseJournalEntryWithDb } from '@/lib/accounting/provider-accounting';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/expenses/[id]/pay - Mark expense as paid
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    const expenseResult = await db.query('SELECT * FROM expenses WHERE id = $1 LIMIT 1', [params.id]);
    const expense = expenseResult.rows[0];

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, expense.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (expense.status !== 'approved') {
      return NextResponse.json({ error: 'Only approved expenses can be marked as paid' }, { status: 400 });
    }

    if (body.bank_account_id) {
      const bankAccount = await db.query('SELECT id FROM bank_accounts WHERE id = $1 AND company_id = $2 LIMIT 1', [
        body.bank_account_id,
        expense.company_id,
      ]);
      if (!bankAccount.rowCount) {
        return NextResponse.json({ error: 'Invalid bank account' }, { status: 400 });
      }
    }

    const updateData: any = {
      status: 'paid',
      paid_by: user.id,
      paid_at: new Date().toISOString(),
    };

    if (body.bank_account_id) updateData.bank_account_id = body.bank_account_id;
    if (body.payment_method) updateData.payment_method = body.payment_method;
    if (body.reference_number) updateData.reference = body.reference_number;

    const fields = Object.keys(updateData);
    const setSql = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => updateData[f]);

    const updatedResult = await db.query(
      `UPDATE expenses
       SET ${setSql}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [params.id, ...values]
    );

    const updatedExpense = updatedResult.rows[0];

    let paidByUser = null;
    if (updatedExpense.paid_by) {
      const paidByResult = await db.query('SELECT id, full_name, email FROM user_profiles WHERE id = $1 LIMIT 1', [
        updatedExpense.paid_by,
      ]);
      paidByUser = paidByResult.rows[0] || null;
    }

    let expenseAccount = null;
    if (updatedExpense.expense_account_id) {
      const expenseAccountResult = await db.query('SELECT id, name, code FROM accounts WHERE id = $1 LIMIT 1', [
        updatedExpense.expense_account_id,
      ]);
      expenseAccount = expenseAccountResult.rows[0] || null;
    }

    if (!expense.journal_entry_id && expenseAccount?.code) {
      const journalResult = await createExpenseJournalEntryWithDb(
        db,
        {
          id: updatedExpense.id,
          expense_number: updatedExpense.expense_number,
          expense_date: updatedExpense.expense_date,
          amount: Number(updatedExpense.total || updatedExpense.amount || 0),
          account_code: expenseAccount.code,
          description: updatedExpense.description || 'Expense',
          bank_account_id: updatedExpense.bank_account_id,
        },
        user.id
      );

      if (journalResult.journalEntryId) {
        await db.query('UPDATE expenses SET journal_entry_id = $2 WHERE id = $1', [params.id, journalResult.journalEntryId]);
        updatedExpense.journal_entry_id = journalResult.journalEntryId;
      } else if (!journalResult.success) {
        console.error('Failed to create journal entry for expense:', journalResult.error);
      }
    }

    return NextResponse.json({
      data: {
        ...updatedExpense,
        paid_by_user: paidByUser,
        expense_account: expenseAccount,
      },
      message: 'Expense marked as paid successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
