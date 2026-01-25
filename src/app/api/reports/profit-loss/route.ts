import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/reports/profit-loss
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Multi-tenant: Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Multi-tenant: Get and verify company_id
    const companyId = searchParams.get('company_id');
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Multi-tenant: Verify user has access to this company
    const { data: membership } = await supabase
      .from('user_companies')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
    }
    
    const startDate = searchParams.get('start_date') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];
    const compareStart = searchParams.get('compare_start');
    const compareEnd = searchParams.get('compare_end');

    // Get all revenue accounts (4xxx)
    const { data: revenueAccounts } = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('company_id', companyId)
      .gte('code', '4000')
      .lt('code', '5000')
      .order('code');

    // Get all expense accounts (5xxx-9xxx)
    const { data: expenseAccounts } = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('company_id', companyId)
      .gte('code', '5000')
      .order('code');

    // Get invoices for the period (revenue)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, total, currency, invoice_date, status')
      .eq('company_id', companyId)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate);

    // Get bills for the period (expenses)
    const { data: bills } = await supabase
      .from('bills')
      .select('id, total, currency, bill_date, status')
      .eq('company_id', companyId)
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);

    // Get expenses for the period
    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, amount, currency, date, category')
      .eq('company_id', companyId)
      .gte('date', startDate)
      .lte('date', endDate);

    // Get journal entry lines for the period
    const { data: entries } = await supabase
      .from('journal_lines')
      .select(`
        account_id,
        debit,
        credit,
        journal_entry:journal_entries!inner (entry_date, status)
      `)
      .eq('journal_entry.status', 'posted')
      .gte('journal_entry.entry_date', startDate)
      .lte('journal_entries.entry_date', endDate);

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
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
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
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
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
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
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
