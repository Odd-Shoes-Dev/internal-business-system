import { NextRequest, NextResponse } from 'next/server';
import { buildRatesMap, convertCurrency } from '@/lib/exchange-rates';
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

    // Fetch all data and exchange rates in parallel
    const [
      bankAccountsResult,
      incomeEntriesResult,
      assetsResult,
      beginningInvoicesResult,
      endingInvoicesResult,
      beginningBillsResult,
      endingBillsResult,
      assetPurchasesResult,
      ratesResult,
    ] = await Promise.all([
      db.query(`SELECT id, name, currency FROM bank_accounts WHERE company_id = $1`, [companyId]),
      db.query(
        `SELECT a.code,
                jl.debit,
                jl.credit,
                COALESCE(NULLIF(jl.currency, ''), $3) AS currency
         FROM journal_lines jl
         INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
         INNER JOIN accounts a ON a.id = jl.account_id
         WHERE je.company_id = $1
           AND je.status = 'posted'
           AND je.entry_date >= $2::date
           AND je.entry_date <= $4::date
           AND a.company_id = $1
           AND a.code >= '4000'`,
        [companyId, startDate, baseCurrency, endDate]
      ),
      db.query(
        `SELECT accumulated_depreciation, depreciation_start_date, useful_life_months, purchase_price, residual_value
         FROM fixed_assets
         WHERE company_id = $1 AND status = 'active' AND depreciation_start_date <= $2::date`,
        [companyId, endDate]
      ),
      db.query(
        `SELECT total, currency, invoice_date FROM invoices
         WHERE company_id = $1 AND invoice_date < $2::date AND status <> 'paid'`,
        [companyId, startDate]
      ),
      db.query(
        `SELECT total, currency, invoice_date FROM invoices
         WHERE company_id = $1 AND invoice_date <= $2::date AND status <> 'paid'`,
        [companyId, endDate]
      ),
      db.query(
        `SELECT total, currency, bill_date FROM bills
         WHERE company_id = $1 AND bill_date < $2::date AND status <> 'paid'`,
        [companyId, startDate]
      ),
      db.query(
        `SELECT total, currency, bill_date FROM bills
         WHERE company_id = $1 AND bill_date <= $2::date AND status <> 'paid'`,
        [companyId, endDate]
      ),
      db.query(
        `SELECT purchase_price, currency, purchase_date FROM fixed_assets
         WHERE company_id = $1 AND purchase_date >= $2::date AND purchase_date <= $3::date`,
        [companyId, startDate, endDate]
      ),
      db.query(
        `SELECT from_currency, to_currency, rate, effective_date::text FROM exchange_rates ORDER BY effective_date DESC`
      ),
    ]);

    const ratesMap = buildRatesMap(ratesResult.rows, baseCurrency);
    const conv = (amount: number, currency: string) =>
      convertCurrency(amount, currency || baseCurrency, baseCurrency, ratesMap);

    // Bank balances
    const bankAccounts = bankAccountsResult.rows;
    let beginningCash = 0;
    let netChangeInCash = 0;

    for (const account of bankAccounts) {
      const currency = account.currency || baseCurrency;

      const [beginTxResult, periodTxResult] = await Promise.all([
        db.query(
          `SELECT amount FROM bank_transactions
           WHERE company_id = $1 AND bank_account_id = $2 AND transaction_date < $3::date`,
          [companyId, account.id, startDate]
        ),
        db.query(
          `SELECT amount FROM bank_transactions
           WHERE company_id = $1 AND bank_account_id = $2
             AND transaction_date >= $3::date AND transaction_date <= $4::date`,
          [companyId, account.id, startDate, endDate]
        ),
      ]);

      const beginBal = beginTxResult.rows.reduce((s: number, t: any) => s + (parseFloat(t.amount) || 0), 0);
      const periodChange = periodTxResult.rows.reduce((s: number, t: any) => s + (parseFloat(t.amount) || 0), 0);

      beginningCash += conv(beginBal, currency);
      netChangeInCash += conv(periodChange, currency);
    }

    // Net income from journal entries
    let totalRevenue = 0;
    let totalExpenses = 0;
    incomeEntriesResult.rows.forEach((entry: any) => {
      const debit = conv(parseFloat(entry.debit) || 0, entry.currency);
      const credit = conv(parseFloat(entry.credit) || 0, entry.currency);
      if (entry.code >= '4000' && entry.code < '5000') {
        totalRevenue += credit - debit;
      } else {
        totalExpenses += debit - credit;
      }
    });
    const netIncome = totalRevenue - totalExpenses;

    // Depreciation
    let depreciation = 0;
    for (const asset of assetsResult.rows) {
      const monthly = ((parseFloat(asset.purchase_price) || 0) - (parseFloat(asset.residual_value) || 0)) / (parseFloat(asset.useful_life_months) || 1);
      const startMonth = new Date(Math.max(new Date(startDate).getTime(), new Date(asset.depreciation_start_date).getTime()));
      const months = Math.max(0, Math.floor((new Date(endDate).getTime() - startMonth.getTime()) / (30 * 24 * 60 * 60 * 1000)));
      depreciation += monthly * Math.min(months, asset.useful_life_months);
    }

    // AR change
    const beginningAR = beginningInvoicesResult.rows.reduce((s: number, inv: any) =>
      s + conv(parseFloat(inv.total) || 0, inv.currency || baseCurrency), 0);
    const endingAR = endingInvoicesResult.rows.reduce((s: number, inv: any) =>
      s + conv(parseFloat(inv.total) || 0, inv.currency || baseCurrency), 0);
    const arChange = endingAR - beginningAR;

    // AP change
    const beginningAP = beginningBillsResult.rows.reduce((s: number, bill: any) =>
      s + conv(parseFloat(bill.total) || 0, bill.currency || baseCurrency), 0);
    const endingAP = endingBillsResult.rows.reduce((s: number, bill: any) =>
      s + conv(parseFloat(bill.total) || 0, bill.currency || baseCurrency), 0);
    const apChange = endingAP - beginningAP;

    // Asset purchases
    const assetPurchaseTotal = assetPurchasesResult.rows.reduce((s: number, asset: any) =>
      s + conv(parseFloat(asset.purchase_price) || 0, asset.currency || baseCurrency), 0);

    const cashFlowStatement = {
      period: { startDate, endDate },
      currency: baseCurrency,
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
