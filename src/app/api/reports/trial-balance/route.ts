import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/reports/trial-balance
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
    
    const asOfDate = searchParams.get('as_of_date') || new Date().toISOString().split('T')[0];

    // Get all accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name, account_type, normal_balance')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('code');

    // Get all posted journal entry lines up to the date, scoped to this company
    const { data: entries } = await supabase
      .from('journal_lines')
      .select(`
        account_id,
        debit,
        credit,
        journal_entry:journal_entries!inner (entry_date, status, company_id)
      `)
      .eq('journal_entry.company_id', companyId)
      .eq('journal_entry.status', 'posted')
      .lte('journal_entry.entry_date', asOfDate);

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
