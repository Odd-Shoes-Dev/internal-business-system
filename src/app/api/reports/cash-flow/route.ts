import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

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

    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const currencyRpc = {
      rpc: async (fn: string, args: any) => {
        if (fn !== 'convert_currency') {
          return { data: null, error: new Error('Unsupported RPC function') };
        }
        try {
          const result = await db.query<{ value: number }>(
            `SELECT convert_currency($1::numeric, $2::text, $3::text, $4::date) AS value`,
            [args.p_amount, args.p_from_currency, args.p_to_currency, args.p_date]
          );
          return { data: result.rows[0]?.value ?? null, error: null };
        } catch {
          return { data: null, error: new Error('Currency conversion failed') };
        }
      },
    };

    const bankAccountsResult = await db.query(
      `SELECT id, name, currency
       FROM bank_accounts
       WHERE company_id = $1`,
      [companyId]
    );
    const bankAccounts = bankAccountsResult.rows;

    let beginningCash = 0;
    for (const account of bankAccounts) {
      const beginningTransactionsResult = await db.query(
        `SELECT amount, transaction_date
         FROM bank_transactions
         WHERE company_id = $1
           AND bank_account_id = $2
           AND transaction_date < $3::date`,
        [companyId, account.id, startDate]
      );
      const beginningTransactions = beginningTransactionsResult.rows;
      const accountBeginningBalance = beginningTransactions?.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0) || 0;

      let balanceInBase = accountBeginningBalance;
      const currency = account.currency || baseCurrency;
      if (currency !== 'USD' && accountBeginningBalance !== 0) {
        const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
          p_amount: Math.abs(accountBeginningBalance),
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: startDate,
        });
        balanceInBase = accountBeginningBalance < 0 ? -(convertedValue || Math.abs(accountBeginningBalance)) : (convertedValue || Math.abs(accountBeginningBalance));
      }
      beginningCash += balanceInBase;
    }

    let netChangeInCash = 0;
    for (const account of bankAccounts) {
      const periodTransactionsResult = await db.query(
        `SELECT amount, transaction_date
         FROM bank_transactions
         WHERE company_id = $1
           AND bank_account_id = $2
           AND transaction_date >= $3::date
           AND transaction_date <= $4::date`,
        [companyId, account.id, startDate, endDate]
      );
      const periodTransactions = periodTransactionsResult.rows;
      const accountPeriodChange = periodTransactions?.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0) || 0;

      let changeInBase = accountPeriodChange;
      const currency = account.currency || baseCurrency;
      if (currency !== 'USD' && accountPeriodChange !== 0) {
        const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
          p_amount: Math.abs(accountPeriodChange),
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: endDate,
        });
        changeInBase = accountPeriodChange < 0 ? -(convertedValue || Math.abs(accountPeriodChange)) : (convertedValue || Math.abs(accountPeriodChange));
      }
      netChangeInCash += changeInBase;
    }

    // Net income from journal entries (same source as P&L — avoids double-counting)
    const incomeEntriesResult = await db.query(
      `SELECT a.code,
              COALESCE(NULLIF(jl.base_debit, 0), jl.debit) AS debit,
              COALESCE(NULLIF(jl.base_credit, 0), jl.credit) AS credit
       FROM journal_lines jl
       INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
       INNER JOIN accounts a ON a.id = jl.account_id
       WHERE je.company_id = $1
         AND je.status = 'posted'
         AND je.entry_date >= $2::date
         AND je.entry_date <= $3::date
         AND a.company_id = $1
         AND a.code >= '4000'`,
      [companyId, startDate, endDate]
    );

    let totalRevenue = 0;
    let totalExpenses = 0;
    incomeEntriesResult.rows.forEach((entry: any) => {
      const code = entry.code;
      if (code >= '4000' && code < '5000') {
        totalRevenue += (parseFloat(entry.credit) || 0) - (parseFloat(entry.debit) || 0);
      } else {
        totalExpenses += (parseFloat(entry.debit) || 0) - (parseFloat(entry.credit) || 0);
      }
    });

    const netIncome = totalRevenue - totalExpenses;

    const assetsResult = await db.query(
      `SELECT accumulated_depreciation, depreciation_start_date, useful_life_months, purchase_price, residual_value
       FROM fixed_assets
       WHERE company_id = $1
         AND status = 'active'
         AND depreciation_start_date <= $2::date`,
      [companyId, endDate]
    );
    const assets = assetsResult.rows;

    let depreciation = 0;
    for (const asset of assets) {
      const monthlyDepreciation = ((parseFloat(asset.purchase_price) || 0) - (parseFloat(asset.residual_value) || 0)) / (parseFloat(asset.useful_life_months) || 1);
      const startMonth = new Date(Math.max(new Date(startDate).getTime(), new Date(asset.depreciation_start_date).getTime()));
      const endMonth = new Date(endDate);
      const monthsInPeriod = Math.max(0, Math.floor((endMonth.getTime() - startMonth.getTime()) / (30 * 24 * 60 * 60 * 1000)));
      depreciation += monthlyDepreciation * Math.min(monthsInPeriod, asset.useful_life_months);
    }

    const beginningInvoicesResult = await db.query(
      `SELECT total, currency, invoice_date
       FROM invoices
       WHERE company_id = $1
         AND invoice_date < $2::date
         AND status <> 'paid'`,
      [companyId, startDate]
    );
    const beginningInvoices = beginningInvoicesResult.rows;

    let beginningAR = 0;
    for (const invoice of beginningInvoices) {
      let amountInBase = parseFloat(invoice.total) || 0;
      const currency = invoice.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
          p_amount: amountInBase,
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: invoice.invoice_date,
        });
        amountInBase = Number(convertedValue) || amountInBase;
      }
      beginningAR += amountInBase;
    }

    const endingInvoicesResult = await db.query(
      `SELECT total, currency, invoice_date
       FROM invoices
       WHERE company_id = $1
         AND invoice_date <= $2::date
         AND status <> 'paid'`,
      [companyId, endDate]
    );
    const endingInvoices = endingInvoicesResult.rows;

    let endingAR = 0;
    for (const invoice of endingInvoices) {
      let amountInBase = parseFloat(invoice.total) || 0;
      const currency = invoice.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
          p_amount: amountInBase,
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: invoice.invoice_date,
        });
        amountInBase = Number(convertedValue) || amountInBase;
      }
      endingAR += amountInBase;
    }

    const arChange = endingAR - beginningAR;

    const beginningBillsResult = await db.query(
      `SELECT total, currency, bill_date
       FROM bills
       WHERE company_id = $1
         AND bill_date < $2::date
         AND status <> 'paid'`,
      [companyId, startDate]
    );
    const beginningBills = beginningBillsResult.rows;

    let beginningAP = 0;
    for (const bill of beginningBills) {
      let amountInBase = parseFloat(bill.total) || 0;
      const currency = bill.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
          p_amount: amountInBase,
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: bill.bill_date,
        });
        amountInBase = Number(convertedValue) || amountInBase;
      }
      beginningAP += amountInBase;
    }

    const endingBillsResult = await db.query(
      `SELECT total, currency, bill_date
       FROM bills
       WHERE company_id = $1
         AND bill_date <= $2::date
         AND status <> 'paid'`,
      [companyId, endDate]
    );
    const endingBills = endingBillsResult.rows;

    let endingAP = 0;
    for (const bill of endingBills) {
      let amountInBase = parseFloat(bill.total) || 0;
      const currency = bill.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
          p_amount: amountInBase,
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: bill.bill_date,
        });
        amountInBase = Number(convertedValue) || amountInBase;
      }
      endingAP += amountInBase;
    }

    const apChange = endingAP - beginningAP;

    const assetPurchasesResult = await db.query(
      `SELECT purchase_price, currency, purchase_date
       FROM fixed_assets
       WHERE company_id = $1
         AND purchase_date >= $2::date
         AND purchase_date <= $3::date`,
      [companyId, startDate, endDate]
    );
    const assetPurchases = assetPurchasesResult.rows;

    let assetPurchaseTotal = 0;
    for (const asset of assetPurchases) {
      let amountInBase = parseFloat(asset.purchase_price) || 0;
      const currency = asset.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
          p_amount: amountInBase,
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: asset.purchase_date,
        });
        amountInBase = Number(convertedValue) || amountInBase;
      }
      assetPurchaseTotal += amountInBase;
    }

    const cashFlowStatement = {
      period: {
        startDate,
        endDate,
      },
      operatingActivities: {
        netIncome,
        adjustments: [{ label: 'Depreciation', amount: depreciation }],
        changesInWorkingCapital: [
          { label: 'Increase in Accounts Receivable', amount: -arChange },
          { label: 'Increase in Accounts Payable', amount: apChange },
        ],
        netCashFromOperating: netIncome + depreciation - arChange + apChange,
      },
      investingActivities: {
        items: [{ label: 'Purchase of Fixed Assets', amount: -assetPurchaseTotal }],
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




