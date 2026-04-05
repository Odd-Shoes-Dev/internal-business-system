import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const cafeAccountsResult = await db.query(
      `SELECT id FROM accounts WHERE (company_id = $1 OR company_id IS NULL) AND code LIKE '42%'`,
      [companyId]
    );
    const cafeAccountIds = cafeAccountsResult.rows.map((r: any) => r.id);

    let revenue = 0;
    if (cafeAccountIds.length > 0) {
      const revenueResult = await db.query(
        `SELECT COALESCE(SUM(credit), 0) AS total
         FROM journal_lines
         WHERE account_id = ANY($1::uuid[])
           AND created_at >= $2::timestamptz
           AND created_at <= $3::timestamptz
           AND credit > 0`,
        [cafeAccountIds, monthStart, monthEnd]
      );
      revenue = Number(revenueResult.rows[0]?.total || 0);
    }

    const expensesResult = await db.query(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM expenses
       WHERE company_id = $1
         AND department = 'Cafe'
         AND expense_date >= $2::timestamptz
         AND expense_date <= $3::timestamptz`,
      [companyId, monthStart, monthEnd]
    );
    const expenses = Number(expensesResult.rows[0]?.total || 0);

    const employeesResult = await db.query(
      `SELECT id, basic_salary
       FROM employees
       WHERE company_id = $1
         AND department = 'Cafe'
         AND employment_status = 'active'`,
      [companyId]
    );
    const employeeCount = employeesResult.rows.length;
    const totalPayroll = employeesResult.rows.reduce((sum: number, row: any) => sum + Number(row.basic_salary || 0), 0);

    const profit = revenue - expenses;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    const monthlyData: Array<{ month: string; revenue: number; expenses: number; profit: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ms = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
      const me = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

      let mr = 0;
      if (cafeAccountIds.length > 0) {
        const mrResult = await db.query(
          `SELECT COALESCE(SUM(credit), 0) AS total
           FROM journal_lines
           WHERE account_id = ANY($1::uuid[])
             AND created_at >= $2::timestamptz
             AND created_at <= $3::timestamptz
             AND credit > 0`,
          [cafeAccountIds, ms, me]
        );
        mr = Number(mrResult.rows[0]?.total || 0);
      }

      const meResult = await db.query(
        `SELECT COALESCE(SUM(total), 0) AS total
         FROM expenses
         WHERE company_id = $1
           AND department = 'Cafe'
           AND expense_date >= $2::timestamptz
           AND expense_date <= $3::timestamptz`,
        [companyId, ms, me]
      );
      const meTotal = Number(meResult.rows[0]?.total || 0);

      monthlyData.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
        revenue: mr,
        expenses: meTotal,
        profit: mr - meTotal,
      });
    }

    const expenseRows = await db.query(
      `SELECT category, total
       FROM expenses
       WHERE company_id = $1
         AND department = 'Cafe'
         AND expense_date >= $2::timestamptz
         AND expense_date <= $3::timestamptz`,
      [companyId, monthStart, monthEnd]
    );

    const categoryTotals: Record<string, number> = {};
    for (const row of expenseRows.rows as any[]) {
      const category = row.category || 'Other';
      categoryTotals[category] = (categoryTotals[category] || 0) + Number(row.total || 0);
    }
    categoryTotals.Payroll = totalPayroll;

    const denominator = expenses + totalPayroll;
    const expenseBreakdown = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: denominator > 0 ? (amount / denominator) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      stats: {
        revenue,
        expenses,
        profit,
        profitMargin,
        employeeCount,
        totalPayroll,
      },
      monthlyData,
      expenseBreakdown,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
