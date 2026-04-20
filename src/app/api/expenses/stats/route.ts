import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const requestedCompanyId = getCompanyIdFromRequest(request);
    let companyId = requestedCompanyId;

    if (!companyId) {
      const userCompany = await db.query(
        `SELECT company_id
         FROM user_companies
         WHERE user_id = $1
         ORDER BY is_primary DESC, joined_at ASC
         LIMIT 1`,
        [user.id]
      );
      companyId = userCompany.rows[0]?.company_id || null;
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company found for user' }, { status: 403 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const allExpenses = await db.query(
      `SELECT COALESCE(total, amount, 0) AS total,
              currency,
              expense_date::text AS expense_date,
              status
       FROM expenses
       WHERE company_id = $1`,
      [companyId]
    );

    let thisMonthTotal = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let paidCount = 0;

    for (const expense of allExpenses.rows || []) {
      const amount = parseFloat(String(expense.total)) || 0;

      let amountUSD = amount;
      if (expense.currency && expense.currency !== 'USD') {
        const converted = await db.query<{ converted: number | null }>(
          'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
          [amount, expense.currency, 'USD', expense.expense_date]
        );
        amountUSD = parseFloat(String(converted.rows[0]?.converted)) || amount;
      }

      const expDate = String(expense.expense_date).slice(0, 10);
      if (expDate >= firstDayOfMonth && expDate <= lastDayOfMonth) {
        thisMonthTotal += amountUSD;
      }

      const status = String(expense.status || 'pending').toLowerCase();
      if (status === 'pending' || status === 'pending_approval') {
        pendingCount += 1;
      } else if (status === 'approved') {
        approvedCount += 1;
      } else if (status === 'paid') {
        paidCount += 1;
      }
    }

    return NextResponse.json({
      thisMonth: thisMonthTotal,
      pendingApproval: pendingCount,
      approved: approvedCount,
      paid: paidCount,
    });
  } catch (error) {
    console.error('Error calculating expense stats:', error);
    return NextResponse.json({ error: 'Failed to calculate expense stats' }, { status: 500 });
  }
}
