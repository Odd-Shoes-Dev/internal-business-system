import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/expenses/[id]/approve - Approve expense
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const expenseResult = await db.query('SELECT * FROM expenses WHERE id = $1 LIMIT 1', [params.id]);
    const expense = expenseResult.rows[0];

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, expense.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (expense.status !== 'pending') {
      return NextResponse.json({ error: `Cannot approve expense with status: ${expense.status}` }, { status: 400 });
    }

    const updatedResult = await db.query(
      `UPDATE expenses
       SET status = 'approved',
           approved_by = $2,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [params.id, user.id]
    );

    const updated = updatedResult.rows[0];

    const approverResult = await db.query(
      `SELECT up.id, up.full_name, up.email
       FROM user_profiles up
       WHERE up.id = $1
       LIMIT 1`,
      [updated.approved_by]
    );

    const data = {
      ...updated,
      approved_by_user: approverResult.rows[0] || null,
    };

    return NextResponse.json({ data, message: 'Expense approved successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
