import { NextRequest, NextResponse } from 'next/server';
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

    // Get all revenue accounts (4xxx)
    const revenueAccountsResult = await db.query(
      `SELECT id, code, name
       FROM accounts
       WHERE company_id = $1
         AND code >= '4000'
         AND code < '5000'
       ORDER BY code ASC`,
      [companyId]
    );
    const revenueAccounts = revenueAccountsResult.rows;

    // Get all expense accounts (5xxx-9xxx)
    const expenseAccountsResult = await db.query(
      `SELECT id, code, name
       FROM accounts
       WHERE company_id = $1
         AND code >= '5000'
       ORDER BY code ASC`,
      [companyId]
    );
    const expenseAccounts = expenseAccountsResult.rows;

    // Get journal entry lines for the period
    const entriesResult = await db.query(
      `SELECT jl.account_id,
              COALESCE(NULLIF(jl.base_debit, 0), jl.debit) AS debit,
              COALESCE(NULLIF(jl.base_credit, 0), jl.credit) AS credit
       FROM journal_lines jl
       INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.company_id = $1
         AND je.status = 'posted'
         AND je.entry_date >= $2::date
         AND je.entry_date <= $3::date`,
      [companyId, startDate, endDate]
    );
    const entries = entriesResult.rows;

    // Calculate totals by account (all amounts in company base currency)
    const accountTotals: Record<string, { debit: number; credit: number }> = {};

    entries?.forEach((entry: any) => {
      if (!accountTotals[entry.account_id]) {
        accountTotals[entry.account_id] = { debit: 0, credit: 0 };
      }
      accountTotals[entry.account_id].debit += parseFloat(entry.debit) || 0;
      accountTotals[entry.account_id].credit += parseFloat(entry.credit) || 0;
    });

    // Build revenue section
    const revenue: any[] = [];
    let totalRevenue = 0;

    revenueAccounts?.forEach((account) => {
      const totals = accountTotals[account.id] || { debit: 0, credit: 0 };
      // Revenue accounts have credit balance
      const balance = totals.credit - totals.debit;
      if (balance !== 0) {
        revenue.push({
          code: account.code,
          name: account.name,
          amount: balance,
        });
        totalRevenue += balance;
      }
    });


    // Build expense sections
    const costOfSales: any[] = [];
    const operatingExpenses: any[] = [];
    const otherExpenses: any[] = [];
    let totalCostOfSales = 0;
    let totalOperatingExpenses = 0;
    let totalOtherExpenses = 0;

    expenseAccounts?.forEach((account) => {
      const totals = accountTotals[account.id] || { debit: 0, credit: 0 };
      // Expense accounts have debit balance
      const balance = totals.debit - totals.credit;
      if (balance !== 0) {
        const item = {
          code: account.code,
          name: account.name,
          amount: balance,
        };

        if (account.code.startsWith('51')) {
          costOfSales.push(item);
          totalCostOfSales += balance;
        } else if (account.code.startsWith('5') || account.code.startsWith('6')) {
          operatingExpenses.push(item);
          totalOperatingExpenses += balance;
        } else {
          otherExpenses.push(item);
          totalOtherExpenses += balance;
        }
      }
    });


    const grossProfit = totalRevenue - totalCostOfSales;
    const operatingIncome = grossProfit - totalOperatingExpenses;
    const netIncome = operatingIncome - totalOtherExpenses;

    return NextResponse.json({
      data: {
        period: { startDate, endDate },
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




