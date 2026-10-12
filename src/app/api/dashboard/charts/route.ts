import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { convertCurrency, getRatesMap } from '@/lib/exchange-rates';

// GET /api/dashboard/charts?company_id= — data for the dashboard charts, in the base currency.
// Revenue and expenses come from the ledger (posted journal lines), so they agree with the
// Profit & Loss report and include POS sales, invoices, bills and expenses alike.
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const company = await db.query<{ currency: string }>('SELECT currency FROM companies WHERE id = $1', [companyId]);
    const baseCurrency = company.rows[0]?.currency || 'USD';
    const ratesMap = await getRatesMap(db, baseCurrency);
    const toBase = (amount: number, currency: string | null) =>
      convertCurrency(Number(amount) || 0, currency || baseCurrency, baseCurrency, ratesMap);

    const [monthly, daily, topProducts, receivables, expenseAccounts] = await Promise.all([
      // Revenue and expenses per month, last 12 months including this one
      db.query<{ month: string; revenue: string; expenses: string }>(
        `SELECT to_char(date_trunc('month', je.entry_date), 'YYYY-MM') AS month,
                COALESCE(SUM(CASE WHEN a.account_type = 'revenue' THEN jl.base_credit - jl.base_debit END), 0) AS revenue,
                COALESCE(SUM(CASE WHEN a.account_type = 'expense' THEN jl.base_debit - jl.base_credit END), 0) AS expenses
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         JOIN accounts a ON a.id = jl.account_id
         WHERE je.company_id = $1 AND je.status = 'posted'
           AND je.entry_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
         GROUP BY 1`,
        [companyId]
      ),
      // Revenue per day, last 30 days
      db.query<{ day: string; revenue: string }>(
        `SELECT je.entry_date::text AS day,
                COALESCE(SUM(jl.base_credit - jl.base_debit), 0) AS revenue
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         JOIN accounts a ON a.id = jl.account_id
         WHERE je.company_id = $1 AND je.status = 'posted' AND a.account_type = 'revenue'
           AND je.entry_date >= CURRENT_DATE - 29
         GROUP BY 1`,
        [companyId]
      ),
      // What sold, last 30 days (net of discount, before tax)
      db.query<{ name: string; currency: string | null; amount: string; quantity: string }>(
        `SELECT COALESCE(p.name, il.description) AS name, i.currency,
                SUM(il.line_total) AS amount, SUM(il.quantity) AS quantity
         FROM invoice_lines il
         JOIN invoices i ON i.id = il.invoice_id
         LEFT JOIN products p ON p.id = il.product_id
         WHERE i.company_id = $1 AND i.document_type IN ('invoice', 'pos_sale')
           AND i.status NOT IN ('draft', 'void', 'cancelled')
           AND i.invoice_date >= CURRENT_DATE - 29
         GROUP BY 1, 2`,
        [companyId]
      ),
      // Unpaid invoices by how overdue they are
      db.query<{ days_overdue: number; balance: string; currency: string | null }>(
        `SELECT (CURRENT_DATE - due_date) AS days_overdue, (total - COALESCE(amount_paid, 0)) AS balance, currency
         FROM invoices
         WHERE company_id = $1 AND document_type IN ('invoice', 'pos_sale')
           AND status NOT IN ('draft', 'void', 'cancelled', 'paid')
           AND total - COALESCE(amount_paid, 0) > 0.01`,
        [companyId]
      ),
      // Expenses this month by account
      db.query<{ name: string; amount: string }>(
        `SELECT a.name, SUM(jl.base_debit - jl.base_credit) AS amount
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         JOIN accounts a ON a.id = jl.account_id
         WHERE je.company_id = $1 AND je.status = 'posted' AND a.account_type = 'expense'
           AND je.entry_date >= date_trunc('month', CURRENT_DATE)
         GROUP BY a.name
         HAVING SUM(jl.base_debit - jl.base_credit) > 0`,
        [companyId]
      ),
    ]);

    const round = (n: number) => Math.round(n * 100) / 100;

    // Every month and day appears, with zero where nothing happened
    const today = new Date();
    const byMonth = new Map(monthly.rows.map((r) => [r.month, r]));
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = byMonth.get(key);
      return { month: key, revenue: round(Number(row?.revenue || 0)), expenses: round(Number(row?.expenses || 0)) };
    });

    const byDay = new Map(daily.rows.map((r) => [r.day, Number(r.revenue)]));
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29 + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { date: key, revenue: round(byDay.get(key) || 0) };
    });

    const productTotals = new Map<string, { amount: number; quantity: number }>();
    for (const r of topProducts.rows) {
      const t = productTotals.get(r.name) || { amount: 0, quantity: 0 };
      t.amount += toBase(Number(r.amount), r.currency);
      t.quantity += Number(r.quantity);
      productTotals.set(r.name, t);
    }
    const products = [...productTotals.entries()]
      .map(([name, t]) => ({ name, amount: round(t.amount), quantity: t.quantity }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    const buckets = [
      { bucket: 'Not due', test: (d: number) => d <= 0 },
      { bucket: '1–30', test: (d: number) => d >= 1 && d <= 30 },
      { bucket: '31–60', test: (d: number) => d >= 31 && d <= 60 },
      { bucket: '61–90', test: (d: number) => d >= 61 && d <= 90 },
      { bucket: '90+', test: (d: number) => d > 90 },
    ];
    const aging = buckets.map((b) => ({
      bucket: b.bucket,
      amount: round(receivables.rows.filter((r) => b.test(Number(r.days_overdue))).reduce((s, r) => s + toBase(Number(r.balance), r.currency), 0)),
    }));

    // Biggest expense accounts; the rest folded into "Other"
    const expenseRows = expenseAccounts.rows.map((r) => ({ name: r.name, amount: round(Number(r.amount)) })).sort((a, b) => b.amount - a.amount);
    const expenses = expenseRows.slice(0, 6);
    const otherTotal = expenseRows.slice(6).reduce((s, r) => s + r.amount, 0);
    if (otherTotal > 0) expenses.push({ name: 'Other', amount: round(otherTotal) });

    return NextResponse.json({
      currency: baseCurrency,
      months,
      days,
      top_products: products,
      receivables_aging: aging,
      expenses_by_account: expenses,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
