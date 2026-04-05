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

    const asOfDate = searchParams.get('as_of_date') || new Date().toISOString().split('T')[0];

    const accountsResult = await db.query(
      `SELECT id, code, name, account_type, normal_balance
       FROM accounts
       WHERE company_id = $1
         AND is_active = true
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

    // Calculate balances by account
    const accountTotals: Record<string, { debit: number; credit: number }> = {};
    
    entries?.forEach((entry: any) => {
      if (!accountTotals[entry.account_id]) {
        accountTotals[entry.account_id] = { debit: 0, credit: 0 };
      }
      accountTotals[entry.account_id].debit += entry.debit || 0;
      accountTotals[entry.account_id].credit += entry.credit || 0;
    });

    // Build trial balance
    const trialBalance: any[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    accounts?.forEach((account) => {
      const totals = accountTotals[account.id] || { debit: 0, credit: 0 };
      const netDebit = totals.debit - totals.credit;
      
      // Skip accounts with no activity
      if (totals.debit === 0 && totals.credit === 0) return;

      let debitBalance = 0;
      let creditBalance = 0;

      if (netDebit > 0) {
        debitBalance = netDebit;
        totalDebits += netDebit;
      } else if (netDebit < 0) {
        creditBalance = -netDebit;
        totalCredits += -netDebit;
      }

      trialBalance.push({
        code: account.code,
        name: account.name,
        type: account.account_type,
        debit: debitBalance,
        credit: creditBalance,
      });
    });

    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    return NextResponse.json({
      data: {
        asOfDate,
        accounts: trialBalance,
        totals: {
          debit: totalDebits,
          credit: totalCredits,
        },
        isBalanced,
        difference: totalDebits - totalCredits,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

