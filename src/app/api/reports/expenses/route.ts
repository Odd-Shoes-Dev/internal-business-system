import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { getRatesMap, convertCurrency } from '@/lib/exchange-rates';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { searchParams } = new URL(request.url);
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) return companyAccessError;

    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'paid';

    const where: string[] = ['e.company_id = $1'];
    const params: any[] = [companyId];

    if (status !== 'all') {
      params.push(status);
      where.push(`e.status = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      where.push(`e.expense_date >= $${params.length}::date`);
    }
    if (endDate) {
      params.push(endDate);
      where.push(`e.expense_date <= $${params.length}::date`);
    }
    if (category && category !== 'all') {
      params.push(category);
      where.push(`e.category = $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const companyResult = await db.query(
      `SELECT name, currency, address, phone, email, logo_url FROM companies WHERE id = $1 LIMIT 1`,
      [companyId]
    );
    const company = companyResult.rows[0];

    const expensesResult = await db.query(
      `SELECT
         e.id,
         e.expense_number,
         e.expense_date,
         e.description,
         e.category,
         e.department,
         e.amount,
         e.tax_amount,
         e.total,
         e.currency,
         e.payment_method,
         e.status,
         v.name AS vendor_name,
         a.name AS account_name,
         a.code AS account_code
       FROM expenses e
       LEFT JOIN vendors v ON v.id = e.vendor_id
       LEFT JOIN accounts a ON a.id = e.expense_account_id
       ${whereSql}
       ORDER BY e.expense_date ASC, e.expense_number ASC`,
      params
    );

    const expenses = expensesResult.rows;
    const companyCurrency = company?.currency || 'USD';
    const ratesMap = await getRatesMap(db, companyCurrency);

    // Group by category with subtotals — convert each expense to company currency
    const categoryMap: Record<string, { items: typeof expenses; total: number }> = {};
    let grandTotal = 0;

    for (const exp of expenses) {
      const cat = exp.category || 'No Category';
      if (!categoryMap[cat]) categoryMap[cat] = { items: [], total: 0 };
      const expCurrency = exp.currency || companyCurrency;
      const converted = convertCurrency(Number(exp.total || 0), expCurrency, companyCurrency, ratesMap);
      categoryMap[cat].items.push({ ...exp, converted_total: converted });
      categoryMap[cat].total += converted;
      grandTotal += converted;
    }

    const categories = Object.entries(categoryMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, data]) => ({ name, items: data.items, total: data.total }));

    // Distinct categories for filter dropdown
    const allCategoriesResult = await db.query(
      `SELECT DISTINCT category FROM expenses WHERE company_id = $1 AND category IS NOT NULL ORDER BY category`,
      [companyId]
    );

    return NextResponse.json({
      data: {
        company: {
          name: company?.name,
          currency: company?.currency || 'USD',
          address: company?.address,
          phone: company?.phone,
          email: company?.email,
          logo_url: company?.logo_url,
        },
        period: { startDate, endDate },
        currency: company?.currency || 'USD',
        categories,
        grandTotal,
        totalExpenses: expenses.length,
        availableCategories: allCategoriesResult.rows.map((r: any) => r.category),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
