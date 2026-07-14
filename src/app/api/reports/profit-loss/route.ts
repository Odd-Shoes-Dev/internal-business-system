import { NextRequest, NextResponse } from 'next/server';
import { buildRatesMap, convertCurrency } from '@/lib/exchange-rates';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/reports/profit-loss
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const companyRow = await db.query<{ currency: string }>(
      'SELECT currency FROM companies WHERE id = $1',
      [companyId]
    );
    const baseCurrency = companyRow.rows[0]?.currency || 'USD';

    const startDate = searchParams.get('start_date') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    // Get journal lines with account info and exchange rates in parallel.
    // Filter on je.company_id (not accounts.company_id) so the report works
    // regardless of whether accounts were seeded with the correct company_id.
    const [entriesResult, ratesResult] = await Promise.all([
      db.query(
        `SELECT a.code AS account_code,
                a.name AS account_name,
                jl.debit,
                jl.credit,
                COALESCE(NULLIF(jl.currency, ''), $4) AS currency
         FROM journal_lines jl
         INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
         LEFT JOIN accounts a ON a.id = jl.account_id
         WHERE je.company_id = $1
           AND je.status = 'posted'
           AND je.entry_date >= $2::date
           AND je.entry_date <= $3::date
           AND a.code >= '4000'
         ORDER BY a.code ASC`,
        [companyId, startDate, endDate, baseCurrency]
      ),
      db.query(
        `SELECT from_currency, to_currency, rate, effective_date::text FROM exchange_rates ORDER BY effective_date DESC`
      ),
    ]);
    const entries = entriesResult.rows;
    const ratesMap = buildRatesMap(ratesResult.rows, baseCurrency);
    const conv = (amount: number, currency: string) =>
      convertCurrency(amount, currency || baseCurrency, baseCurrency, ratesMap);

    // Accumulate totals by account code
    const accountTotals: Record<string, { name: string; debit: number; credit: number }> = {};
    entries?.forEach((entry: any) => {
      const code = entry.account_code;
      if (!code) return;
      if (!accountTotals[code]) {
        accountTotals[code] = { name: entry.account_name || code, debit: 0, credit: 0 };
      }
      const lineCurrency = entry.currency || baseCurrency;
      accountTotals[code].debit += conv(parseFloat(entry.debit) || 0, lineCurrency);
      accountTotals[code].credit += conv(parseFloat(entry.credit) || 0, lineCurrency);
    });

    // Build revenue section (4xxx — credit balance)
    const revenue: any[] = [];
    let totalRevenue = 0;

    // Build expense sections (5xxx+ — debit balance)
    const costOfSales: any[] = [];
    const operatingExpenses: any[] = [];
    const otherExpenses: any[] = [];
    let totalCostOfSales = 0;
    let totalOperatingExpenses = 0;
    let totalOtherExpenses = 0;

    Object.entries(accountTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([code, { name, debit, credit }]) => {
        if (code >= '4000' && code < '5000') {
          const balance = credit - debit;
          if (balance !== 0) {
            revenue.push({ code, name, amount: balance });
            totalRevenue += balance;
          }
        } else {
          const balance = debit - credit;
          if (balance !== 0) {
            const item = { code, name, amount: balance };
            if (code.startsWith('51')) {
              costOfSales.push(item);
              totalCostOfSales += balance;
            } else if (code.startsWith('5') || code.startsWith('6')) {
              operatingExpenses.push(item);
              totalOperatingExpenses += balance;
            } else {
              otherExpenses.push(item);
              totalOtherExpenses += balance;
            }
          }
        }
      });


    const grossProfit = totalRevenue - totalCostOfSales;
    const operatingIncome = grossProfit - totalOperatingExpenses;
    const netIncome = operatingIncome - totalOtherExpenses;

    return NextResponse.json({
      data: {
        period: { startDate, endDate },
        currency: baseCurrency,
        revenue: {
          items: revenue,
          total: totalRevenue,
        },
        costOfSales: {
          items: costOfSales,
          total: totalCostOfSales,
        },
        grossProfit,
        operatingExpenses: {
          items: operatingExpenses,
          total: totalOperatingExpenses,
        },
        operatingIncome,
        otherExpenses: {
          items: otherExpenses,
          total: totalOtherExpenses,
        },
        netIncome,
      },
    });
  } catch (error: any) {
    console.error('Error generating profit-loss report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}






