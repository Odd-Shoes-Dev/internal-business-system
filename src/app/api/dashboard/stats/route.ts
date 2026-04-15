import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    // Get company_id from query params (required for multi-company users)
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    // Get enabled modules to filter data appropriately
    // subscription_modules may not exist yet — fall back to company_modules
    let moduleIds: string[] = [];
    try {
      const enabledModules = await db.query<{ module_id: string }>(
        'SELECT module_id FROM subscription_modules WHERE company_id = $1 AND is_active = TRUE',
        [companyId]
      );
      moduleIds = enabledModules.rows?.map((m) => m.module_id) || [];
    } catch {
      try {
        const fallback = await db.query<{ module_id: string }>(
          'SELECT module_id FROM company_modules WHERE company_id = $1 AND is_active = TRUE',
          [companyId]
        );
        moduleIds = fallback.rows?.map((m) => m.module_id) || [];
      } catch {
        moduleIds = [];
      }
    }

    // Date ranges for current and previous month
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    // Fetch all financial data - FILTERED BY COMPANY
    const [invoices, bills, expenses, bankTransactions,
      currentMonthInvoices, prevMonthInvoices,
      currentMonthExpenses, prevMonthExpenses,
      currentMonthBankTx, prevMonthBankTx,
    ] = await Promise.all([
      db.query<{ total: number; amount_paid: number; status: string; currency: string; invoice_date: string }>(
        'SELECT total, amount_paid, status, currency, invoice_date FROM invoices WHERE company_id = $1',
        [companyId]
      ),
      db.query<{ total: number; amount_paid: number; status: string; currency: string; bill_date: string }>(
        'SELECT total, amount_paid, status, currency, bill_date FROM bills WHERE company_id = $1',
        [companyId]
      ),
      db.query<{ total: number; currency: string; expense_date: string }>(
        'SELECT total, currency, expense_date FROM expenses WHERE company_id = $1',
        [companyId]
      ),
      db.query<{ amount: number; transaction_type: string; transaction_date: string; currency: string | null }>(
        `SELECT bt.amount, bt.transaction_type, bt.transaction_date, ba.currency
         FROM bank_transactions bt
         JOIN bank_accounts ba ON ba.id = bt.bank_account_id
         WHERE ba.company_id = $1`,
        [companyId]
      ),
      // Current month paid invoices
      db.query<{ total: number; currency: string; invoice_date: string }>(
        `SELECT total, currency, invoice_date FROM invoices
         WHERE company_id = $1 AND status = 'paid' AND invoice_date >= $2`,
        [companyId, currentMonthStart]
      ),
      // Previous month paid invoices
      db.query<{ total: number; currency: string; invoice_date: string }>(
        `SELECT total, currency, invoice_date FROM invoices
         WHERE company_id = $1 AND status = 'paid' AND invoice_date >= $2 AND invoice_date <= $3`,
        [companyId, prevMonthStart, prevMonthEnd]
      ),
      // Current month expenses
      db.query<{ total: number; currency: string; expense_date: string }>(
        `SELECT total, currency, expense_date FROM expenses
         WHERE company_id = $1 AND expense_date >= $2`,
        [companyId, currentMonthStart]
      ),
      // Previous month expenses
      db.query<{ total: number; currency: string; expense_date: string }>(
        `SELECT total, currency, expense_date FROM expenses
         WHERE company_id = $1 AND expense_date >= $2 AND expense_date <= $3`,
        [companyId, prevMonthStart, prevMonthEnd]
      ),
      // Current month bank transactions
      db.query<{ amount: number; transaction_date: string; currency: string | null }>(
        `SELECT bt.amount, bt.transaction_date, ba.currency
         FROM bank_transactions bt
         JOIN bank_accounts ba ON ba.id = bt.bank_account_id
         WHERE ba.company_id = $1 AND bt.transaction_date >= $2`,
        [companyId, currentMonthStart]
      ),
      // Previous month bank transactions
      db.query<{ amount: number; transaction_date: string; currency: string | null }>(
        `SELECT bt.amount, bt.transaction_date, ba.currency
         FROM bank_transactions bt
         JOIN bank_accounts ba ON ba.id = bt.bank_account_id
         WHERE ba.company_id = $1 AND bt.transaction_date >= $2 AND bt.transaction_date <= $3`,
        [companyId, prevMonthStart, prevMonthEnd]
      ),
    ]);

    let totalRevenue = 0;
    let totalExpenses = 0;
    let accountsReceivable = 0;
    let accountsPayable = 0;
    let cashBalance = 0;

    // Process invoices
    if (invoices.rows) {
      for (const invoice of invoices.rows) {
        let amountInUSD = invoice.total;
        let remainingInUSD = invoice.total - (invoice.amount_paid || 0);

        if (invoice.currency !== 'USD') {
          const convertedTotal = await db.query<{ converted: number | null }>(
            'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
            [invoice.total, invoice.currency, 'USD', invoice.invoice_date]
          );

          const convertedRemaining = await db.query<{ converted: number | null }>(
            'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
            [invoice.total - (invoice.amount_paid || 0), invoice.currency, 'USD', invoice.invoice_date]
          );

          amountInUSD = convertedTotal.rows[0]?.converted || invoice.total;
          remainingInUSD = convertedRemaining.rows[0]?.converted || (invoice.total - (invoice.amount_paid || 0));
        }

        if (invoice.status === 'paid') {
          totalRevenue += amountInUSD;
        }
        
        if (invoice.status !== 'paid' && invoice.status !== 'void' && invoice.status !== 'cancelled') {
          accountsReceivable += remainingInUSD;
        }
      }
    }

    // Process bills
    if (bills.rows) {
      for (const bill of bills.rows) {
        let remainingInUSD = bill.total - (bill.amount_paid || 0);

        if (bill.currency !== 'USD') {
          const convertedRemaining = await db.query<{ converted: number | null }>(
            'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
            [bill.total - (bill.amount_paid || 0), bill.currency, 'USD', bill.bill_date]
          );

          remainingInUSD = convertedRemaining.rows[0]?.converted || (bill.total - (bill.amount_paid || 0));
        }

        if (bill.status !== 'paid' && bill.status !== 'void') {
          accountsPayable += remainingInUSD;
        }
      }
    }

    // Process expenses
    if (expenses.rows) {
      for (const expense of expenses.rows) {
        let amountInUSD = expense.total;

        if (expense.currency !== 'USD') {
          const converted = await db.query<{ converted: number | null }>(
            'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
            [expense.total, expense.currency, 'USD', expense.expense_date]
          );

          amountInUSD = converted.rows[0]?.converted || expense.total;
        }

        totalExpenses += amountInUSD;
      }
    }

    // Process bank transactions for cash balance
    if (bankTransactions.rows) {
      for (const transaction of bankTransactions.rows) {
        const currency = transaction.currency || 'USD';
        
        let amountInUSD = transaction.amount || 0;

        // Convert to USD if not already
        if (currency !== 'USD') {
          const converted = await db.query<{ converted: number | null }>(
            'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
            [Math.abs(transaction.amount), currency, 'USD', transaction.transaction_date]
          );
          const convertedValue = converted.rows[0]?.converted || Math.abs(transaction.amount);

          // Preserve the sign (positive or negative)
          amountInUSD = transaction.amount < 0 ? -convertedValue : convertedValue;
        }

        cashBalance += amountInUSD;
      }
    }

    // Calculate inventory value - ONLY IF INVENTORY MODULE ENABLED
    let inventoryValue = 0;
    if (moduleIds.includes('inventory') || moduleIds.includes('retail') || moduleIds.includes('cafe')) {
      const inventoryItems = await db.query<{ quantity_on_hand: number; cost_price: number; currency: string | null }>(
        'SELECT quantity_on_hand, cost_price, currency FROM products WHERE company_id = $1 AND track_inventory = TRUE',
        [companyId]
      );

      if (inventoryItems.rows) {
        for (const item of inventoryItems.rows) {
          const quantity = item.quantity_on_hand || 0;
          const cost = item.cost_price || 0;
          const itemValue = quantity * cost;

          if (itemValue > 0) {
            let valueInUSD = itemValue;

            if (item.currency && item.currency !== 'USD') {
              const converted = await db.query<{ converted: number | null }>(
                'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
                [itemValue, item.currency, 'USD', new Date().toISOString().split('T')[0]]
              );

              valueInUSD = converted.rows[0]?.converted || itemValue;
            }

            inventoryValue += valueInUSD;
          }
        }
      }
    }

    const netIncome = totalRevenue - totalExpenses;

    // Helper: convert a currency amount to USD using the DB function
    const convertToUSD = async (amount: number, currency: string, date: string): Promise<number> => {
      if (currency === 'USD') return amount;
      const result = await db.query<{ converted: number | null }>(
        'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
        [amount, currency, 'USD', date]
      );
      return result.rows[0]?.converted ?? amount;
    };

    // Helper: sum invoice rows in USD
    const sumInvoicesUSD = async (rows: { total: number; currency: string; invoice_date: string }[]) => {
      let total = 0;
      for (const row of rows) {
        total += await convertToUSD(row.total, row.currency, row.invoice_date);
      }
      return total;
    };

    // Helper: sum expense rows in USD
    const sumExpensesUSD = async (rows: { total: number; currency: string; expense_date: string }[]) => {
      let total = 0;
      for (const row of rows) {
        total += await convertToUSD(row.total, row.currency, row.expense_date);
      }
      return total;
    };

    // Helper: sum bank transaction rows in USD (net)
    const sumBankTxUSD = async (rows: { amount: number; transaction_date: string; currency: string | null }[]) => {
      let total = 0;
      for (const row of rows) {
        const currency = row.currency || 'USD';
        const abs = await convertToUSD(Math.abs(row.amount), currency, row.transaction_date);
        total += row.amount < 0 ? -abs : abs;
      }
      return total;
    };

    // Calculate period totals for trend comparison
    const [
      currentRevenue, prevRevenue,
      currentExpensesTotal, prevExpensesTotal,
      currentCashNet, prevCashNet,
    ] = await Promise.all([
      sumInvoicesUSD(currentMonthInvoices.rows || []),
      sumInvoicesUSD(prevMonthInvoices.rows || []),
      sumExpensesUSD(currentMonthExpenses.rows || []),
      sumExpensesUSD(prevMonthExpenses.rows || []),
      sumBankTxUSD(currentMonthBankTx.rows || []),
      sumBankTxUSD(prevMonthBankTx.rows || []),
    ]);

    const currentNetIncome = currentRevenue - currentExpensesTotal;
    const prevNetIncome = prevRevenue - prevExpensesTotal;

    // Calculate % change: null when no previous data to compare
    const calcTrend = (current: number, previous: number): number | null => {
      if (previous === 0) return current > 0 ? 100 : null;
      return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
    };

    const revenueTrend = calcTrend(currentRevenue, prevRevenue);
    const expensesTrend = calcTrend(currentExpensesTotal, prevExpensesTotal);
    const netIncomeTrend = calcTrend(currentNetIncome, prevNetIncome);
    const cashBalanceTrend = calcTrend(currentCashNet, prevCashNet);

    // Return stats with conditional fields based on enabled modules
    const stats: any = {
      totalRevenue,
      totalExpenses,
      netIncome,
      accountsReceivable,
      accountsPayable,
      cashBalance,
      trends: {
        revenue: revenueTrend,
        expenses: expensesTrend,
        netIncome: netIncomeTrend,
        cashBalance: cashBalanceTrend,
      },
    };

    // Only include inventory value if inventory/retail/cafe module is enabled
    if (moduleIds.includes('inventory') || moduleIds.includes('retail') || moduleIds.includes('cafe')) {
      stats.inventoryValue = inventoryValue;
    }

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Failed to calculate dashboard stats:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
