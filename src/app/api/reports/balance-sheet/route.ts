import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { buildRatesMap, convertCurrency } from '@/lib/exchange-rates';

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

    const companyRow = await db.query<{ currency: string }>(
      'SELECT currency FROM companies WHERE id = $1',
      [companyId]
    );
    const baseCurrency = companyRow.rows[0]?.currency || 'USD';

    const asOfDate = searchParams.get('asOfDate') || searchParams.get('as_of_date') || new Date().toISOString().split('T')[0];

    const [entriesResult, ratesResult] = await Promise.all([
      // Query journal lines with account info via join — avoids depending on accounts.company_id
      db.query(
        `SELECT a.code,
                a.name,
                jl.debit,
                jl.credit,
                COALESCE(NULLIF(jl.currency, ''), $2) AS currency
         FROM journal_lines jl
         INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
         LEFT JOIN accounts a ON a.id = jl.account_id
         WHERE je.company_id = $1
           AND je.status = 'posted'
           AND je.entry_date <= $3::date
           AND a.code < '4000'`,
        [companyId, baseCurrency, asOfDate]
      ),
      db.query(
        `SELECT from_currency, to_currency, rate, effective_date::text FROM exchange_rates ORDER BY effective_date DESC`
      ),
    ]);

    const ratesMap = buildRatesMap(ratesResult.rows, baseCurrency);

    // Accumulate net debit balance per account code
    const accountBalances: Record<string, { name: string; balance: number }> = {};
    entriesResult.rows.forEach((row: any) => {
      const code = row.code;
      if (!code) return;
      if (!accountBalances[code]) {
        accountBalances[code] = { name: row.name || code, balance: 0 };
      }
      const debit = convertCurrency(parseFloat(row.debit) || 0, row.currency, baseCurrency, ratesMap);
      const credit = convertCurrency(parseFloat(row.credit) || 0, row.currency, baseCurrency, ratesMap);
      accountBalances[code].balance += debit - credit;
    });

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

    // Classify each account balance into balance sheet sections
    Object.entries(accountBalances)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([code, { name, balance: rawBalance }]) => {
        // Assets (1xxx) are debit-normal; liabilities/equity (2xxx-3xxx) are credit-normal
        let balance = code.startsWith('1') ? rawBalance : -rawBalance;

      if (balance === 0) return;

      const item = {
        code,
        name,
        amount: Math.abs(balance),
      };

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

    // Retained earnings: net of all income/expense account activity up to asOfDate
    const incomeEntriesResult = await db.query(
      `SELECT a.code,
              jl.debit,
              jl.credit,
              COALESCE(NULLIF(jl.currency, ''), $3) AS currency
       FROM journal_lines jl
       INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
       LEFT JOIN accounts a ON a.id = jl.account_id
       WHERE je.company_id = $1
         AND je.status = 'posted'
         AND je.entry_date <= $2::date
         AND a.code >= '4000'`,
      [companyId, asOfDate, baseCurrency]
    );
    const incomeEntries = incomeEntriesResult.rows.map((row: any) => ({
      code: row.code,
      debit: convertCurrency(parseFloat(row.debit) || 0, row.currency, baseCurrency, ratesMap),
      credit: convertCurrency(parseFloat(row.credit) || 0, row.currency, baseCurrency, ratesMap),
    }));

    let retainedEarnings = 0;
    incomeEntries.forEach((entry: any) => {
      const code = entry.code;
      if (code >= '4000' && code < '5000') {
        retainedEarnings += (parseFloat(entry.credit) || 0) - (parseFloat(entry.debit) || 0);
      } else {
        retainedEarnings -= (parseFloat(entry.debit) || 0) - (parseFloat(entry.credit) || 0);
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
        currency: baseCurrency,
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


