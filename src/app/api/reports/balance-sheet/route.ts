import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/reports/balance-sheet
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

    const asOfDate = searchParams.get('asOfDate') || searchParams.get('as_of_date') || new Date().toISOString().split('T')[0];

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

    const accountsResult = await db.query(
      `SELECT id, code, name, account_type, normal_balance
       FROM accounts
       WHERE company_id = $1
       ORDER BY code ASC`,
      [companyId]
    );
    const accounts = accountsResult.rows;

    const entriesResult = await db.query(
      `SELECT jl.account_id, jl.debit, jl.credit
       FROM journal_lines jl
       INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.company_id = $1
         AND je.status = 'posted'
         AND je.entry_date <= $2::date`,
      [companyId, asOfDate]
    );
    const entries = entriesResult.rows;

    const accountBalances: Record<string, number> = {};

    entries.forEach((entry: any) => {
      if (!accountBalances[entry.account_id]) {
        accountBalances[entry.account_id] = 0;
      }
      accountBalances[entry.account_id] += (entry.debit || 0) - (entry.credit || 0);
    });

    const assetsResult = await db.query(
      `SELECT id, name, purchase_price, accumulated_depreciation, status, purchase_date, currency
       FROM fixed_assets
       WHERE company_id = $1
         AND purchase_date <= $2::date
         AND status IN ('active', 'fully_depreciated')`,
      [companyId, asOfDate]
    );
    const assets = assetsResult.rows;

    const inventoryResult = await db.query(
      `SELECT id, name, quantity_on_hand, cost, currency
       FROM products
       WHERE company_id = $1
         AND quantity_on_hand > 0`,
      [companyId]
    );
    const inventory = inventoryResult.rows;

    const bankAccountsResult = await db.query(
      `SELECT id, name, currency, created_at
       FROM bank_accounts
       WHERE company_id = $1`,
      [companyId]
    );
    const bankAccounts = bankAccountsResult.rows;

    const invoicesResult = await db.query(
      `SELECT id, total, currency, invoice_date
       FROM invoices
       WHERE company_id = $1
         AND invoice_date <= $2::date
         AND status <> 'paid'`,
      [companyId, asOfDate]
    );
    const invoices = invoicesResult.rows;

    const billsResult = await db.query(
      `SELECT id, total, currency, bill_date
       FROM bills
       WHERE company_id = $1
         AND bill_date <= $2::date
         AND status <> 'paid'`,
      [companyId, asOfDate]
    );
    const bills = billsResult.rows;

    const currentAssets: any[] = [];
    const fixedAssets: any[] = [];
    const otherAssets: any[] = [];
    const currentLiabilities: any[] = [];
    const longTermLiabilities: any[] = [];
    const equity: any[] = [];

    let totalCurrentAssets = 0;
    let totalFixedAssets = 0;
    let totalOtherAssets = 0;
    let totalCurrentLiabilities = 0;
    let totalLongTermLiabilities = 0;
    let totalEquity = 0;

    accounts.forEach((account: any) => {
      let balance = accountBalances[account.id] || 0;

      if (account.normal_balance === 'credit') {
        balance = -balance;
      }

      if (balance === 0) return;

      const item = {
        code: account.code,
        name: account.name,
        amount: Math.abs(balance),
      };

      const code = account.code;

      if (code.startsWith('1')) {
        if (code < '1500') {
          currentAssets.push(item);
          totalCurrentAssets += balance;
        } else if (code < '1800') {
          fixedAssets.push(item);
          totalFixedAssets += balance;
        } else {
          otherAssets.push(item);
          totalOtherAssets += balance;
        }
      } else if (code.startsWith('2')) {
        if (code < '2500') {
          currentLiabilities.push(item);
          totalCurrentLiabilities += balance;
        } else {
          longTermLiabilities.push(item);
          totalLongTermLiabilities += balance;
        }
      } else if (code.startsWith('3')) {
        equity.push(item);
        totalEquity += balance;
      }
    });

    for (const asset of assets) {
      const bookValue = asset.purchase_price - (asset.accumulated_depreciation || 0);
      if (bookValue <= 0) continue;

      let bookValueInUSD = bookValue;
      const currency = asset.currency || 'USD';

      if (currency !== 'USD') {
        const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
          p_amount: bookValue,
          p_from_currency: currency,
          p_to_currency: 'USD',
          p_date: asOfDate,
        });
        bookValueInUSD = convertedValue || bookValue;
      }

      fixedAssets.push({
        code: '',
        name: asset.name,
        amount: bookValueInUSD,
      });
      totalFixedAssets += bookValueInUSD;
    }

    let inventoryTotal = 0;
    for (const item of inventory) {
      const inventoryValue = item.quantity_on_hand * item.cost;
      let valueInUSD = inventoryValue;
      const currency = item.currency || 'USD';

      if (currency !== 'USD') {
        const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
          p_amount: inventoryValue,
          p_from_currency: currency,
          p_to_currency: 'USD',
          p_date: asOfDate,
        });
        valueInUSD = convertedValue || inventoryValue;
      }

      inventoryTotal += valueInUSD;
    }

    if (inventoryTotal > 0) {
      currentAssets.push({
        code: '1300',
        name: 'Inventory',
        amount: inventoryTotal,
      });
      totalCurrentAssets += inventoryTotal;
    }

    for (const account of bankAccounts) {
      const transactionsResult = await db.query(
        `SELECT amount, transaction_date
         FROM bank_transactions
         WHERE company_id = $1
           AND bank_account_id = $2
           AND transaction_date <= $3::date`,
        [companyId, account.id, asOfDate]
      );
      const transactions = transactionsResult.rows;

      if (!transactions || transactions.length === 0) continue;

      let balance = 0;
      for (const txn of transactions) {
        let amountInUSD = txn.amount;
        const currency = account.currency || 'USD';

        if (currency !== 'USD') {
          const { data: convertedValue } = await currencyRpc.rpc('convert_currency', {
            p_amount: Math.abs(txn.amount),
            p_from_currency: currency,
            p_to_currency: 'USD',
            p_date: txn.transaction_date,
          });
          amountInUSD = txn.amount < 0 ? -(convertedValue || Math.abs(txn.amount)) : (convertedValue || Math.abs(txn.amount));
        }
        balance += amountInUSD;
      }

      if (balance === 0) continue;

      currentAssets.push({
        code: '1100',
        name: account.name,
        amount: Math.abs(balance),
      });
      totalCurrentAssets += balance;
    }

    let totalAR = 0;
    for (const invoice of invoices) {
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

      totalAR += amountInUSD;
    }

    if (totalAR > 0) {
      currentAssets.push({
        code: '1200',
        name: 'Accounts Receivable',
        amount: totalAR,
      });
      totalCurrentAssets += totalAR;
    }

    let totalAP = 0;
    for (const bill of bills) {
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

      totalAP += amountInUSD;
    }

    if (totalAP > 0) {
      currentLiabilities.push({
        code: '2100',
        name: 'Accounts Payable',
        amount: totalAP,
      });
      totalCurrentLiabilities += totalAP;
    }

    const incomeEntriesResult = await db.query(
      `SELECT a.code, jl.debit, jl.credit
       FROM journal_lines jl
       INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
       INNER JOIN accounts a ON a.id = jl.account_id
       WHERE je.company_id = $1
         AND je.status = 'posted'
         AND je.entry_date <= $2::date
         AND a.company_id = $1
         AND a.code >= '4000'`,
      [companyId, asOfDate]
    );
    const incomeEntries = incomeEntriesResult.rows;

    let retainedEarnings = 0;
    incomeEntries.forEach((entry: any) => {
      const code = entry.code;
      if (code >= '4000' && code < '5000') {
        retainedEarnings += (entry.credit || 0) - (entry.debit || 0);
      } else {
        retainedEarnings -= (entry.debit || 0) - (entry.credit || 0);
      }
    });

    if (retainedEarnings !== 0) {
      equity.push({
        code: '3900',
        name: 'Retained Earnings',
        amount: Math.abs(retainedEarnings),
      });
      totalEquity += retainedEarnings;
    }

    const totalAssets = totalCurrentAssets + totalFixedAssets + totalOtherAssets;
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return NextResponse.json({
      data: {
        asOfDate,
        assets: {
          current: currentAssets.map(item => ({ account: item.name, balance: item.amount })),
          fixed: fixedAssets.map(item => ({ account: item.name, balance: item.amount })),
          totalCurrent: totalCurrentAssets,
          totalFixed: totalFixedAssets,
          totalAssets,
        },
        liabilities: {
          current: currentLiabilities.map(item => ({ account: item.name, balance: item.amount })),
          longTerm: longTermLiabilities.map(item => ({ account: item.name, balance: item.amount })),
          totalCurrent: totalCurrentLiabilities,
          totalLongTerm: totalLongTermLiabilities,
          totalLiabilities,
        },
        equity: {
          items: equity.map(item => ({ account: item.name, balance: item.amount })),
          totalEquity,
        },
        totalLiabilitiesAndEquity,
        isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

