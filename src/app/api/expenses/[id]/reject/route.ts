import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/expenses/[id]/reject - Reject expense
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    if (!body.rejection_reason || body.rejection_reason.trim() === '') {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
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

    if (expense.status === 'paid') {
      return NextResponse.json({ error: 'Cannot reject a paid expense' }, { status: 400 });
    }

    const updatedResult = await db.query(
      `UPDATE expenses
       SET status = 'rejected',
           rejected_by = $2,
           rejected_at = NOW(),
           rejection_reason = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [params.id, user.id, body.rejection_reason]
    );

    const updated = updatedResult.rows[0];

    const rejectorResult = await db.query(
      `SELECT up.id, up.full_name, up.email
       FROM user_profiles up
       WHERE up.id = $1
       LIMIT 1`,
      [updated.rejected_by]
    );

    const data = {
      ...updated,
      rejected_by_user: rejectorResult.rows[0] || null,
    };

    return NextResponse.json({ data, message: 'Expense rejected successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
