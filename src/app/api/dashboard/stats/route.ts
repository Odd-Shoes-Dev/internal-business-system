import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    // Get company base currency so all stats are converted to the right currency
    const companyRow = await db.query<{ currency: string }>(
      'SELECT currency FROM companies WHERE id = $1',
      [companyId]
    );
    const baseCurrency = companyRow.rows[0]?.currency || 'USD';

    // Auto-sync exchange rates if stale
    try {
      const today = new Date().toISOString().split('T')[0];
      const rateCheck = await db.query(
        `SELECT 1 FROM exchange_rates WHERE source = 'open.er-api.com' AND effective_date = $1 LIMIT 1`,
        [today]
      );
      if (rateCheck.rowCount === 0) {
        const baseUrl = request.nextUrl.origin;
        fetch(`${baseUrl}/api/exchange-rates/sync`, {
          method: 'POST',
          headers: { cookie: request.headers.get('cookie') || '' },
        }).catch(() => {});
      }
    } catch { /* non-fatal */ }

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

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const emptyResult = { rows: [], rowCount: 0 };

    const safeBankQuery = async <T>(sql: string, params: any[]) => {
      try {
        return await db.query<T>(sql, params);
      } catch (e: any) {
        console.warn('[dashboard/stats] bank_accounts query skipped (schema not ready):', e?.message);
        return emptyResult as { rows: T[]; rowCount: number };
      }
    };

    const [invoices, bills, expenses,
      currentMonthInvoices, prevMonthInvoices,
      currentMonthExpenses, prevMonthExpenses,
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
      db.query<{ total: number; currency: string; invoice_date: string }>(
        `SELECT total, currency, invoice_date FROM invoices WHERE company_id = $1 AND status = 'paid' AND invoice_date >= $2`,
        [companyId, currentMonthStart]
      ),
      db.query<{ total: number; currency: string; invoice_date: string }>(
        `SELECT total, currency, invoice_date FROM invoices WHERE company_id = $1 AND status = 'paid' AND invoice_date >= $2 AND invoice_date <= $3`,
        [companyId, prevMonthStart, prevMonthEnd]
      ),
      db.query<{ total: number; currency: string; expense_date: string }>(
        `SELECT total, currency, expense_date FROM expenses WHERE company_id = $1 AND expense_date >= $2`,
        [companyId, currentMonthStart]
      ),
      db.query<{ total: number; currency: string; expense_date: string }>(
        `SELECT total, currency, expense_date FROM expenses WHERE company_id = $1 AND expense_date >= $2 AND expense_date <= $3`,
        [companyId, prevMonthStart, prevMonthEnd]
      ),
    ]);

    const [bankTransactions, currentMonthBankTx, prevMonthBankTx] = await Promise.all([
      safeBankQuery<{ amount: number; transaction_type: string; transaction_date: string; currency: string | null }>(
        `SELECT bt.amount, bt.transaction_type, bt.transaction_date, ba.currency FROM bank_transactions bt JOIN bank_accounts ba ON ba.id = bt.bank_account_id WHERE ba.company_id = $1`,
        [companyId]
      ),
      safeBankQuery<{ amount: number; transaction_date: string; currency: string | null }>(
        `SELECT bt.amount, bt.transaction_date, ba.currency FROM bank_transactions bt JOIN bank_accounts ba ON ba.id = bt.bank_account_id WHERE ba.company_id = $1 AND bt.transaction_date >= $2`,
        [companyId, currentMonthStart]
      ),
      safeBankQuery<{ amount: number; transaction_date: string; currency: string | null }>(
        `SELECT bt.amount, bt.transaction_date, ba.currency FROM bank_transactions bt JOIN bank_accounts ba ON ba.id = bt.bank_account_id WHERE ba.company_id = $1 AND bt.transaction_date >= $2 AND bt.transaction_date <= $3`,
        [companyId, prevMonthStart, prevMonthEnd]
      ),
    ]);

    // Convert any amount to the company base currency
    const convertToBase = async (amount: number, currency: string, date: string): Promise<number> => {
      const safeAmount = parseFloat(String(amount)) || 0;
      if (!currency || currency === baseCurrency) return safeAmount;
      const result = await db.query<{ converted: number | null }>(
        'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
        [safeAmount, currency, baseCurrency, date]
      );
      return parseFloat(String(result.rows[0]?.converted)) || safeAmount;
    };

    let totalRevenue = 0;
    let totalExpenses = 0;
    let accountsReceivable = 0;
    let accountsPayable = 0;
    let cashBalance = 0;

    if (invoices.rows) {
      for (const invoice of invoices.rows) {
        const invoiceTotal = parseFloat(String(invoice.total)) || 0;
        const invoicePaid = parseFloat(String(invoice.amount_paid)) || 0;
        const cur = invoice.currency || baseCurrency;
        const amountInBase = await convertToBase(invoiceTotal, cur, invoice.invoice_date);
        const remainingInBase = await convertToBase(invoiceTotal - invoicePaid, cur, invoice.invoice_date);
        if (invoice.status === 'paid') {
          totalRevenue += amountInBase;
        }
        if (invoice.status !== 'paid' && invoice.status !== 'void' && invoice.status !== 'cancelled') {
          accountsReceivable += remainingInBase;
        }
      }
    }

    if (bills.rows) {
      for (const bill of bills.rows) {
        const billTotal = parseFloat(String(bill.total)) || 0;
        const billPaid = parseFloat(String(bill.amount_paid)) || 0;
        const cur = bill.currency || baseCurrency;
        const remainingInBase = await convertToBase(billTotal - billPaid, cur, bill.bill_date);
        if (bill.status !== 'paid' && bill.status !== 'void') {
          accountsPayable += remainingInBase;
        }
      }
    }

    if (expenses.rows) {
      for (const expense of expenses.rows) {
        const expenseTotal = parseFloat(String(expense.total)) || 0;
        const cur = expense.currency || baseCurrency;
        totalExpenses += await convertToBase(expenseTotal, cur, expense.expense_date);
      }
    }

    if (bankTransactions.rows) {
      for (const transaction of bankTransactions.rows) {
        const cur = transaction.currency || baseCurrency;
        const abs = await convertToBase(Math.abs(transaction.amount), cur, transaction.transaction_date);
        cashBalance += transaction.amount < 0 ? -abs : abs;
      }
    }

    let inventoryValue = 0;
    if (moduleIds.includes('inventory') || moduleIds.includes('retail') || moduleIds.includes('cafe')) {
      const inventoryItems = await db.query<{ quantity_on_hand: number; cost_price: number; currency: string | null }>(
        'SELECT quantity_on_hand, cost_price, currency FROM products WHERE company_id = $1 AND track_inventory = TRUE',
        [companyId]
      );
      if (inventoryItems.rows) {
        for (const item of inventoryItems.rows) {
          const itemValue = (item.quantity_on_hand || 0) * (item.cost_price || 0);
          if (itemValue > 0) {
            const cur = item.currency || baseCurrency;
            inventoryValue += await convertToBase(itemValue, cur, new Date().toISOString().split('T')[0]);
          }
        }
      }
    }

    const netIncome = totalRevenue - totalExpenses;

    const sumInvoicesBase = async (rows: { total: number; currency: string; invoice_date: string }[]) => {
      let total = 0;
      for (const row of rows) {
        total += await convertToBase(row.total, row.currency || baseCurrency, row.invoice_date);
      }
      return total;
    };

    const sumExpensesBase = async (rows: { total: number; currency: string; expense_date: string }[]) => {
      let total = 0;
      for (const row of rows) {
        total += await convertToBase(row.total, row.currency || baseCurrency, row.expense_date);
      }
      return total;
    };

    const sumBankTxBase = async (rows: { amount: number; transaction_date: string; currency: string | null }[]) => {
      let total = 0;
      for (const row of rows) {
        const cur = row.currency || baseCurrency;
        const abs = await convertToBase(Math.abs(row.amount), cur, row.transaction_date);
        total += row.amount < 0 ? -abs : abs;
      }
      return total;
    };

    const [
      currentRevenue, prevRevenue,
      currentExpensesTotal, prevExpensesTotal,
      currentCashNet, prevCashNet,
    ] = await Promise.all([
      sumInvoicesBase(currentMonthInvoices.rows || []),
      sumInvoicesBase(prevMonthInvoices.rows || []),
      sumExpensesBase(currentMonthExpenses.rows || []),
      sumExpensesBase(prevMonthExpenses.rows || []),
      sumBankTxBase(currentMonthBankTx.rows || []),
      sumBankTxBase(prevMonthBankTx.rows || []),
    ]);

    const currentNetIncome = currentRevenue - currentExpensesTotal;
    const prevNetIncome = prevRevenue - prevExpensesTotal;

    const calcTrend = (current: number, previous: number): number | null => {
      if (previous === 0) return current > 0 ? 100 : null;
      return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
    };

    const stats: any = {
      totalRevenue,
      totalExpenses,
      netIncome,
      accountsReceivable,
      accountsPayable,
      cashBalance,
      trends: {
        revenue: calcTrend(currentRevenue, prevRevenue),
        expenses: calcTrend(currentExpensesTotal, prevExpensesTotal),
        netIncome: calcTrend(currentNetIncome, prevNetIncome),
        cashBalance: calcTrend(currentCashNet, prevCashNet),
      },
    };

    if (moduleIds.includes('inventory') || moduleIds.includes('retail') || moduleIds.includes('cafe')) {
      stats.inventoryValue = inventoryValue;
    }

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Failed to calculate dashboard stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
