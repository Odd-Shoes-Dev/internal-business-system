import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/integrations/reports/financial-summary
 * Get financial summary data for integrated systems
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Verify API key authentication
    const apiKey = request.headers.get('Authorization');
    const systemId = request.headers.get('X-System-ID');
    
    if (!apiKey || !systemId) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      );
    }

    // Verify the API key and get company access
    const { data: integration, error: authError } = await supabase
      .from('api_integrations')
      .select('company_id, is_active, permissions')
      .eq('api_key', apiKey.replace('Bearer ', ''))
      .eq('external_system_id', systemId)
      .single();

    if (authError || !integration || !integration.is_active) {
      return NextResponse.json(
        { error: 'Invalid authentication credentials' },
        { status: 401 }
      );
    }

    // Check permissions
    if (!integration.permissions?.includes('read:financial_reports')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get query parameters
    const startDate = searchParams.get('start_date') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];
    const companyId = integration.company_id;

    // Fetch financial summary data
    const [revenueData, expenseData, cashData, customerData] = await Promise.all([
      getRevenueData(supabase, companyId, startDate, endDate),
      getExpenseData(supabase, companyId, startDate, endDate),
      getCashData(supabase, companyId),
      getCustomerData(supabase, companyId, startDate, endDate)
    ]);

    const summary = {
      period: { start_date: startDate, end_date: endDate },
      revenue: {
        total_revenue: revenueData.total,
        sales_count: revenueData.count,
        average_sale: revenueData.count > 0 ? revenueData.total / revenueData.count : 0
      },
      expenses: {
        total_expenses: expenseData.total,
        expense_count: expenseData.count
      },
      cash: {
        current_balance: cashData.balance,
        cash_accounts: cashData.accounts
      },
      customers: {
        total_customers: customerData.total,
        new_customers: customerData.new_count,
        active_customers: customerData.active_count
      },
      profitability: {
        gross_profit: revenueData.total - expenseData.total,
        profit_margin: revenueData.total > 0 ? ((revenueData.total - expenseData.total) / revenueData.total * 100) : 0
      }
    };

    return NextResponse.json({ success: true, data: summary });

  } catch (error: any) {
    console.error('Financial summary API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getRevenueData(supabase: any, companyId: string, startDate: string, endDate: string) {
  const { data: revenue } = await supabase
    .from('journal_lines')
    .select(`
      credit,
      journal_entry:journal_entries!inner (
        entry_date,
        status,
        account:accounts!inner (
          account_type
        )
      )
    `)
    .eq('journal_entry.status', 'posted')
    .eq('journal_entry.account.account_type', 'revenue')
    .gte('journal_entry.entry_date', startDate)
    .lte('journal_entry.entry_date', endDate);

  const total = revenue?.reduce((sum: number, entry: any) => sum + (entry.credit || 0), 0) || 0;
  const count = revenue?.length || 0;
  
  return { total, count };
}

async function getExpenseData(supabase: any, companyId: string, startDate: string, endDate: string) {
  const { data: expenses } = await supabase
    .from('journal_lines')
    .select(`
      debit,
      journal_entry:journal_entries!inner (
        entry_date,
        status,
        account:accounts!inner (
          account_type
        )
      )
    `)
    .eq('journal_entry.status', 'posted')
    .eq('journal_entry.account.account_type', 'expense')
    .gte('journal_entry.entry_date', startDate)
    .lte('journal_entry.entry_date', endDate);

  const total = expenses?.reduce((sum: number, entry: any) => sum + (entry.debit || 0), 0) || 0;
  const count = expenses?.length || 0;
  
  return { total, count };
}

async function getCashData(supabase: any, companyId: string) {
  const { data: cashAccounts } = await supabase
    .from('accounts')
    .select('id, name, current_balance')
    .eq('company_id', companyId)
    .in('account_subtype', ['cash', 'bank'])
    .eq('is_active', true);

  const balance = cashAccounts?.reduce((sum: number, account: any) => sum + (account.current_balance || 0), 0) || 0;
  
  return { 
    balance, 
    accounts: cashAccounts?.map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      balance: acc.current_balance
    })) || []
  };
}

async function getCustomerData(supabase: any, companyId: string, startDate: string, endDate: string) {
  const { data: customers } = await supabase
    .from('customers')
    .select('id, created_at, last_activity_date')
    .eq('company_id', companyId);

  const total = customers?.length || 0;
  const new_count = customers?.filter((c: any) => 
    c.created_at >= startDate && c.created_at <= endDate
  ).length || 0;
  const active_count = customers?.filter((c: any) => 
    c.last_activity_date && c.last_activity_date >= startDate
  ).length || 0;
  
  return { total, new_count, active_count };
}