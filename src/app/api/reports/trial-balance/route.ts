import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/reports/trial-balance
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

    const asOfDate = searchParams.get('as_of_date') || searchParams.get('asOfDate') || new Date().toISOString().split('T')[0];

    const companyRow = await db.query<{ currency: string }>(
      'SELECT currency FROM companies WHERE id = $1',
      [companyId]
    );
    const baseCurrency = companyRow.rows[0]?.currency || 'USD';

    // Query journal lines directly, filtered by je.company_id.
    // Joining accounts for names/codes avoids depending on accounts.company_id being set.
    const entriesResult = await db.query(
      `SELECT a.code,
              a.name,
              a.account_type,
              COALESCE(NULLIF(jl.base_debit, 0), jl.debit) AS debit,
              COALESCE(NULLIF(jl.base_credit, 0), jl.credit) AS credit
       FROM journal_lines jl
       INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
       LEFT JOIN accounts a ON a.id = jl.account_id
       WHERE je.company_id = $1
         AND je.status = 'posted'
         AND je.entry_date <= $2::date
       ORDER BY a.code ASC`,
      [companyId, asOfDate]
    );

    // Accumulate by account code
    const accountTotals: Record<string, { name: string; type: string; debit: number; credit: number }> = {};
    entriesResult.rows.forEach((row: any) => {
      const code = row.code || 'UNKNOWN';
      if (!accountTotals[code]) {
        accountTotals[code] = { name: row.name || code, type: row.account_type || '', debit: 0, credit: 0 };
      }
      accountTotals[code].debit += parseFloat(row.debit) || 0;
      accountTotals[code].credit += parseFloat(row.credit) || 0;
    });

    // Build trial balance
    const trialBalance: any[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    Object.entries(accountTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([code, { name, type, debit, credit }]) => {
        if (debit === 0 && credit === 0) return;
        const netDebit = debit - credit;
        let debitBalance = 0;
        let creditBalance = 0;

        if (netDebit > 0) {
          debitBalance = netDebit;
          totalDebits += netDebit;
        } else if (netDebit < 0) {
          creditBalance = -netDebit;
          totalCredits += -netDebit;
        }

        trialBalance.push({ code, name, type, debit: debitBalance, credit: creditBalance });
      });

    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    return NextResponse.json({
      asOfDate,
      currency: baseCurrency,
      accounts: trialBalance,
      totals: {
        totalDebits,
        totalCredits,
        isBalanced,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

