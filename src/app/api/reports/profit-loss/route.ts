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

    const startDate = searchParams.get('start_date') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    const currencyRpc = {
      rpc: async (fn: string, args: any) => {
        if (fn !== 'convert_currency') {
          return { data: null, error: new Error('Unsupported RPC function') };
        }
        const result = await db.query<{ value: number }>(
          `SELECT convert_currency($1::numeric, $2::text, $3::text, $4::date) AS value`,
          [args.p_amount, args.p_from_currency, args.p_to_currency, args.p_date]
        );
        return { data: result.rows[0]?.value ?? null, error: null };
      },
    };

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

    // Get invoices for the period (revenue)
    const invoicesResult = await db.query(
      `SELECT id, total, currency, invoice_date, status
       FROM invoices
       WHERE company_id = $1
         AND invoice_date >= $2::date
         AND invoice_date <= $3::date`,
      [companyId, startDate, endDate]
    );
    const invoices = invoicesResult.rows;

    // Get bills for the period (expenses)
    const billsResult = await db.query(
      `SELECT id, total, currency, bill_date, status
       FROM bills
       WHERE company_id = $1
         AND bill_date >= $2::date
         AND bill_date <= $3::date`,
      [companyId, startDate, endDate]
    );
    const bills = billsResult.rows;

    // Get expenses for the period
    const expensesResult = await db.query(
      `SELECT id, amount, currency, date, category
       FROM expenses
       WHERE company_id = $1
         AND date >= $2::date
         AND date <= $3::date`,
      [companyId, startDate, endDate]
    );
    const expenses = expensesResult.rows;

    // Get journal entry lines for the period
    const entriesResult = await db.query(
      `SELECT jl.account_id, jl.debit, jl.credit
       FROM journal_lines jl
       INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.company_id = $1
         AND je.status = 'posted'
         AND je.entry_date >= $2::date
         AND je.entry_date <= $3::date`,
      [companyId, startDate, endDate]
    );
    const entries = entriesResult.rows;

    // Calculate totals by account
    const accountTotals: Record<string, { debit: number; credit: number }> = {};
    
    entries?.forEach((entry: any) => {
      if (!accountTotals[entry.account_id]) {
        accountTotals[entry.account_id] = { debit: 0, credit: 0 };
      }
      accountTotals[entry.account_id].debit += entry.debit || 0;
      accountTotals[entry.account_id].credit += entry.credit || 0;
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

    // Add invoice revenue (convert to USD)
    for (const invoice of invoices || []) {
      let amountInUSD = invoice.total;
      const currency = invoice.currency || 'USD';
      
      if (currency !== 'USD') {
        const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
          p_amount: invoice.total,
          p_from_currency: currency,
          p_to_currency: 'USD',
          p_date: invoice.invoice_date,
        });
        amountInUSD = convertedValue || invoice.total;
      }
      
      totalRevenue += amountInUSD;
    }

    if (totalRevenue > 0 && invoices && invoices.length > 0) {
      revenue.push({
        code: '4000',
        name: 'Sales Revenue',
        amount: totalRevenue - revenue.reduce((sum, item) => sum + item.amount, 0),
      });
    }

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

    // Add bills to operating expenses (convert to USD)
    for (const bill of bills || []) {
      let amountInUSD = bill.total;
      const currency = bill.currency || 'USD';
      
      if (currency !== 'USD') {
        const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
          p_amount: bill.total,
          p_from_currency: currency,
          p_to_currency: 'USD',
          p_date: bill.bill_date,
        });
        amountInUSD = convertedValue || bill.total;
      }
      
      totalOperatingExpenses += amountInUSD;
    }

    // Add expenses to operating expenses (convert to USD)
    for (const expense of expenses || []) {
      let amountInUSD = expense.amount;
      const currency = expense.currency || 'USD';
      
      if (currency !== 'USD') {
        const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
          p_amount: expense.amount,
          p_from_currency: currency,
          p_to_currency: 'USD',
          p_date: expense.date,
        });
        amountInUSD = convertedValue || expense.amount;
      }
      
      totalOperatingExpenses += amountInUSD;
    }

    if (bills && bills.length > 0) {
      const billsTotal = bills.reduce((sum, bill) => sum + bill.total, 0);
      operatingExpenses.push({
        code: '5000',
        name: 'Vendor Bills',
        amount: billsTotal,
      });
    }

    if (expenses && expenses.length > 0) {
      const expensesTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      operatingExpenses.push({
        code: '5100',
        name: 'Operating Expenses',
        amount: expensesTotal,
      });
    }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

