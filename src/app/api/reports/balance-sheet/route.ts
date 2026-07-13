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

    const companyRow = await db.query<{ currency: string }>(
      'SELECT currency FROM companies WHERE id = $1',
      [companyId]
    );
    const baseCurrency = companyRow.rows[0]?.currency || 'USD';

    const asOfDate = searchParams.get('asOfDate') || searchParams.get('as_of_date') || new Date().toISOString().split('T')[0];

    const accountsResult = await db.query(
      `SELECT id, code, name, account_type, normal_balance
       FROM accounts
       WHERE company_id = $1
       ORDER BY code ASC`,
      [companyId]
    );
    const accounts = accountsResult.rows;

    // All posted journal lines up to the as-of date
    const entriesResult = await db.query(
      `SELECT jl.account_id,
              COALESCE(NULLIF(jl.base_debit, 0), jl.debit) AS debit,
              COALESCE(NULLIF(jl.base_credit, 0), jl.credit) AS credit
       FROM journal_lines jl
       INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.company_id = $1
         AND je.status = 'posted'
         AND je.entry_date <= $2::date`,
      [companyId, asOfDate]
    );
    const entries = entriesResult.rows;

    // Compute net debit balance per account from journal lines
    const accountBalances: Record<string, number> = {};
    entries.forEach((entry: any) => {
      if (!accountBalances[entry.account_id]) {
        accountBalances[entry.account_id] = 0;
      }
      accountBalances[entry.account_id] += (parseFloat(entry.debit) || 0) - (parseFloat(entry.credit) || 0);
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
    accounts.forEach((account: any) => {
      let balance = accountBalances[account.id] || 0;

      // Credit-normal accounts (liabilities, equity, revenue) flip sign to get natural balance
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

    // Retained earnings: net of all income/expense account activity up to asOfDate
    const incomeEntriesResult = await db.query(
      `SELECT a.code,
              COALESCE(NULLIF(jl.base_debit, 0), jl.debit) AS debit,
              COALESCE(NULLIF(jl.base_credit, 0), jl.credit) AS credit
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
