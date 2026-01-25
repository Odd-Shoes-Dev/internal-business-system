import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    // Get bank transactions for the period to calculate cash flow
    const { data: bankAccounts } = await supabase
      .from('bank_accounts')
      .select('id, name, currency');

    // Get beginning cash balance (transactions before start date)
    let beginningCash = 0;
    for (const account of bankAccounts || []) {
      const { data: beginningTransactions } = await supabase
        .from('bank_transactions')
        .select('amount, transaction_date')
        .eq('bank_account_id', account.id)
        .lt('transaction_date', startDate);

      const accountBeginningBalance = beginningTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
      
      // Convert to USD
      let balanceInUSD = accountBeginningBalance;
      const currency = account.currency || 'USD';
      if (currency !== 'USD' && accountBeginningBalance !== 0) {
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
          p_amount: Math.abs(accountBeginningBalance),
          p_from_currency: currency,
          p_to_currency: 'USD',
          p_date: startDate,
        });
        balanceInUSD = accountBeginningBalance < 0 ? -(convertedValue || Math.abs(accountBeginningBalance)) : (convertedValue || Math.abs(accountBeginningBalance));
      }
      beginningCash += balanceInUSD;
    }

    // Get period transactions for cash flow calculation
    let netChangeInCash = 0;
    for (const account of bankAccounts || []) {
      const { data: periodTransactions } = await supabase
        .from('bank_transactions')
        .select('amount, transaction_date')
        .eq('bank_account_id', account.id)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      const accountPeriodChange = periodTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
      
      // Convert to USD
      let changeInUSD = accountPeriodChange;
      const currency = account.currency || 'USD';
      if (currency !== 'USD' && accountPeriodChange !== 0) {
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
          p_amount: Math.abs(accountPeriodChange),
          p_from_currency: currency,
          p_to_currency: 'USD',
          p_date: endDate,
        });
        changeInUSD = accountPeriodChange < 0 ? -(convertedValue || Math.abs(accountPeriodChange)) : (convertedValue || Math.abs(accountPeriodChange));
      }
      netChangeInCash += changeInUSD;
    }

    // Get revenue for period (from invoices)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('total, currency, invoice_date')
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate);

    let totalRevenue = 0;
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

    // Get expenses for period (from bills and expenses)
    const { data: bills } = await supabase
      .from('bills')
      .select('total, currency, bill_date')
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, currency, date')
      .gte('date', startDate)
      .lte('date', endDate);

    let totalExpenses = 0;
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
      totalExpenses += amountInUSD;
    }

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
      totalExpenses += amountInUSD;
    }

    const netIncome = totalRevenue - totalExpenses;

    // Get depreciation from fixed assets
    const { data: assets } = await supabase
      .from('fixed_assets')
      .select('accumulated_depreciation, depreciation_start_date, useful_life_months, purchase_price, residual_value')
      .eq('status', 'active')
      .lte('depreciation_start_date', endDate);

    // Calculate depreciation for the period
    let depreciation = 0;
    for (const asset of assets || []) {
      const monthlyDepreciation = (asset.purchase_price - asset.residual_value) / asset.useful_life_months;
      const startMonth = new Date(Math.max(new Date(startDate).getTime(), new Date(asset.depreciation_start_date).getTime()));
      const endMonth = new Date(endDate);
      const monthsInPeriod = Math.max(0, Math.floor((endMonth.getTime() - startMonth.getTime()) / (30 * 24 * 60 * 60 * 1000)));
      depreciation += monthlyDepreciation * Math.min(monthsInPeriod, asset.useful_life_months);
    }

    // Get changes in AR (from invoices)
    const { data: beginningInvoices } = await supabase
      .from('invoices')
      .select('total, currency, invoice_date')
      .lt('invoice_date', startDate)
      .neq('status', 'paid');

    let beginningAR = 0;
    for (const invoice of beginningInvoices || []) {
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
      beginningAR += amountInUSD;
    }

    const { data: endingInvoices } = await supabase
      .from('invoices')
      .select('total, currency, invoice_date')
      .lte('invoice_date', endDate)
      .neq('status', 'paid');

    let endingAR = 0;
    for (const invoice of endingInvoices || []) {
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
      endingAR += amountInUSD;
    }

    const arChange = endingAR - beginningAR;

    // Get changes in AP (from bills)
    const { data: beginningBills } = await supabase
      .from('bills')
      .select('total, currency, bill_date')
      .lt('bill_date', startDate)
      .neq('status', 'paid');

    let beginningAP = 0;
    for (const bill of beginningBills || []) {
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
      beginningAP += amountInUSD;
    }

    const { data: endingBills } = await supabase
      .from('bills')
      .select('total, currency, bill_date')
      .lte('bill_date', endDate)
      .neq('status', 'paid');

    let endingAP = 0;
    for (const bill of endingBills || []) {
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
      endingAP += amountInUSD;
    }

    const apChange = endingAP - beginningAP;

    // Get fixed asset purchases
    const { data: assetPurchases } = await supabase
      .from('fixed_assets')
      .select('purchase_price, currency, purchase_date')
      .gte('purchase_date', startDate)
      .lte('purchase_date', endDate);

    let assetPurchaseTotal = 0;
    for (const asset of assetPurchases || []) {
      let amountInUSD = asset.purchase_price;
      const currency = asset.currency || 'USD';
      if (currency !== 'USD') {
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
          p_amount: asset.purchase_price,
          p_from_currency: currency,
          p_to_currency: 'USD',
          p_date: asset.purchase_date,
        });
        amountInUSD = convertedValue || asset.purchase_price;
      }
      assetPurchaseTotal += amountInUSD;
    }

    // Build the response
    const cashFlowStatement = {
      period: {
        startDate,
        endDate,
      },
      operatingActivities: {
        netIncome,
        adjustments: [
          { label: 'Depreciation', amount: depreciation },
        ],
        changesInWorkingCapital: [
          { label: 'Increase in Accounts Receivable', amount: -arChange },
          { label: 'Increase in Accounts Payable', amount: apChange },
        ],
        netCashFromOperating: netIncome + depreciation - arChange + apChange,
      },
      investingActivities: {
        items: [
          { label: 'Purchase of Fixed Assets', amount: -assetPurchaseTotal },
        ],
        netCashFromInvesting: -assetPurchaseTotal,
      },
      financingActivities: {
        items: [
          { label: 'Owner Contributions', amount: 0 },
          { label: 'Owner Distributions', amount: 0 },
        ],
        netCashFromFinancing: 0,
      },
      netChangeInCash,
      beginningCash,
      endingCash: beginningCash + netChangeInCash,
    };

    return NextResponse.json(cashFlowStatement);
  } catch (error) {
    console.error('Error generating cash flow report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
