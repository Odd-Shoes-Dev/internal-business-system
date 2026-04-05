import { getDbProvider } from '@/lib/provider';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/integrations/reports/financial-summary
 * Get financial summary data for integrated systems
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDbProvider();
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
    const integrationResult = await db.query(
      `SELECT company_id, is_active, permissions
       FROM api_integrations
       WHERE api_key = $1
         AND external_system_id = $2
       LIMIT 1`,
      [apiKey.replace('Bearer ', ''), systemId]
    );
    const integration = integrationResult.rows[0] as any;

    if (!integration || !integration.is_active) {
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

    await db.query(
      `UPDATE api_integrations
       SET last_used_at = NOW(),
           updated_at = NOW()
       WHERE api_key = $1`,
      [apiKey.replace('Bearer ', '')]
    );

    // Fetch financial summary data
    const [revenueData, expenseData, cashData, customerData] = await Promise.all([
      getRevenueData(db, companyId, startDate, endDate),
      getExpenseData(db, companyId, startDate, endDate),
      getCashData(db, companyId),
      getCustomerData(db, companyId, startDate, endDate)
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

async function getRevenueData(db: any, companyId: string, startDate: string, endDate: string) {
  const result = await db.query(
    `SELECT COALESCE(SUM(jl.credit), 0)::numeric AS total,
            COUNT(*)::int AS count
     FROM journal_lines jl
     INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
     INNER JOIN accounts a ON a.id = jl.account_id
     WHERE je.company_id = $1
       AND je.status = 'posted'
       AND je.entry_date >= $2::date
       AND je.entry_date <= $3::date
       AND LOWER(COALESCE(a.account_type, '')) = 'revenue'`,
    [companyId, startDate, endDate]
  );
  const row = result.rows[0] as any;
  const total = Number(row?.total || 0);
  const count = Number(row?.count || 0);
  
  return { total, count };
}

async function getExpenseData(db: any, companyId: string, startDate: string, endDate: string) {
  const result = await db.query(
    `SELECT COALESCE(SUM(jl.debit), 0)::numeric AS total,
            COUNT(*)::int AS count
     FROM journal_lines jl
     INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
     INNER JOIN accounts a ON a.id = jl.account_id
     WHERE je.company_id = $1
       AND je.status = 'posted'
       AND je.entry_date >= $2::date
       AND je.entry_date <= $3::date
       AND LOWER(COALESCE(a.account_type, '')) = 'expense'`,
    [companyId, startDate, endDate]
  );
  const row = result.rows[0] as any;
  const total = Number(row?.total || 0);
  const count = Number(row?.count || 0);
  
  return { total, count };
}

async function getCashData(db: any, companyId: string) {
  const accountsResult = await db.query(
    `SELECT id, name, current_balance
     FROM accounts
     WHERE company_id = $1
       AND is_active = true
       AND LOWER(COALESCE(account_subtype, '')) IN ('cash', 'bank')
     ORDER BY name ASC`,
    [companyId]
  );
  const cashAccounts = accountsResult.rows as any[];

  const balance = cashAccounts.reduce((sum: number, account: any) => sum + Number(account.current_balance || 0), 0);
  
  return { 
    balance, 
    accounts: cashAccounts.map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      balance: acc.current_balance
    }))
  };
}

async function getCustomerData(db: any, companyId: string, startDate: string, endDate: string) {
  const totalResult = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM customers
     WHERE company_id = $1`,
    [companyId]
  );

  const newResult = await db.query(
    `SELECT COUNT(*)::int AS new_count
     FROM customers
     WHERE company_id = $1
       AND created_at >= $2::date
       AND created_at <= ($3::date + INTERVAL '1 day' - INTERVAL '1 second')`,
    [companyId, startDate, endDate]
  );

  const activeResult = await db.query(
    `SELECT COUNT(DISTINCT customer_id)::int AS active_count
     FROM invoices
     WHERE company_id = $1
       AND invoice_date >= $2::date
       AND invoice_date <= $3::date`,
    [companyId, startDate, endDate]
  );

  const total = Number((totalResult.rows[0] as any)?.total || 0);
  const new_count = Number((newResult.rows[0] as any)?.new_count || 0);
  const active_count = Number((activeResult.rows[0] as any)?.active_count || 0);
  
  return { total, new_count, active_count };
}