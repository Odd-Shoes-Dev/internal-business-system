import { NextRequest, NextResponse } from 'next/server';
import { convertCurrency, getRatesMap } from '@/lib/exchange-rates';
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

    const companyRow = await db.query<{ currency: string }>(
      'SELECT currency FROM companies WHERE id = $1',
      [companyId]
    );
    const baseCurrency = companyRow.rows[0]?.currency || 'USD';
    const ratesMap = await getRatesMap(db, baseCurrency);

    let thisMonthTotal = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let paidCount = 0;

    for (const expense of allExpenses.rows || []) {
      const amount = parseFloat(String(expense.total)) || 0;
      const amountBase = convertCurrency(amount, expense.currency || baseCurrency, baseCurrency, ratesMap);

      const expDate = String(expense.expense_date).slice(0, 10);
      if (expDate >= firstDayOfMonth && expDate <= lastDayOfMonth) {
        thisMonthTotal += amountBase;
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
      currency: baseCurrency,
      pendingApproval: pendingCount,
      approved: approvedCount,
      paid: paidCount,
    });
  } catch (error) {
    console.error('Error calculating expense stats:', error);
    return NextResponse.json({ error: 'Failed to calculate expense stats' }, { status: 500 });
  }
}
