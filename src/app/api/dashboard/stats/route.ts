import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get company_id from query params (required for multi-company users)
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Verify user has access to this company
    const { data: membership } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
    }

    // Get enabled modules to filter data appropriately
    const { data: enabledModules } = await supabase
      .from('subscription_modules')
      .select('module_id')
      .eq('company_id', companyId)
      .eq('is_active', true);

    const moduleIds = enabledModules?.map(m => m.module_id) || [];

    // Fetch all financial data - FILTERED BY COMPANY
    const [
      { data: invoices },
      { data: bills },
      { data: expenses },
      { data: bankTransactions },
    ] = await Promise.all([
      supabase.from('invoices').select('total, amount_paid, status, currency, invoice_date').eq('company_id', companyId),
      supabase.from('bills').select('total, amount_paid, status, currency, bill_date').eq('company_id', companyId),
      supabase.from('expenses').select('total, currency, expense_date').eq('company_id', companyId),
      supabase.from('bank_transactions').select('amount, transaction_type, transaction_date, bank_accounts(currency)').eq('company_id', companyId),
    ]);

    let totalRevenue = 0;
    let totalExpenses = 0;
    let accountsReceivable = 0;
    let accountsPayable = 0;
    let cashBalance = 0;

    // Process invoices
    if (invoices) {
      for (const invoice of invoices) {
        let amountInUSD = invoice.total;
        let remainingInUSD = invoice.total - (invoice.amount_paid || 0);

        if (invoice.currency !== 'USD') {
          const { data: convertedTotal } = await supabase.rpc('convert_currency', {
            p_amount: invoice.total,
            p_from_currency: invoice.currency,
            p_to_currency: 'USD',
            p_date: invoice.invoice_date,
          });

          const { data: convertedRemaining } = await supabase.rpc('convert_currency', {
            p_amount: invoice.total - (invoice.amount_paid || 0),
            p_from_currency: invoice.currency,
            p_to_currency: 'USD',
            p_date: invoice.invoice_date,
          });

          amountInUSD = convertedTotal || invoice.total;
          remainingInUSD = convertedRemaining || (invoice.total - (invoice.amount_paid || 0));
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
    if (bills) {
      for (const bill of bills) {
        let remainingInUSD = bill.total - (bill.amount_paid || 0);

        if (bill.currency !== 'USD') {
          const { data: convertedRemaining } = await supabase.rpc('convert_currency', {
            p_amount: bill.total - (bill.amount_paid || 0),
            p_from_currency: bill.currency,
            p_to_currency: 'USD',
            p_date: bill.bill_date,
          });

          remainingInUSD = convertedRemaining || (bill.total - (bill.amount_paid || 0));
        }

        if (bill.status !== 'paid' && bill.status !== 'void') {
          accountsPayable += remainingInUSD;
        }
      }
    }

    // Process expenses
    if (expenses) {
      for (const expense of expenses) {
        let amountInUSD = expense.total;

        if (expense.currency !== 'USD') {
          const { data: converted } = await supabase.rpc('convert_currency', {
            p_amount: expense.total,
            p_from_currency: expense.currency,
            p_to_currency: 'USD',
            p_date: expense.expense_date,
          });

          amountInUSD = converted || expense.total;
        }

        totalExpenses += amountInUSD;
      }
    }

    // Process bank transactions for cash balance
    if (bankTransactions) {
      for (const transaction of bankTransactions) {
        const bankAccount = Array.isArray(transaction.bank_accounts) 
          ? transaction.bank_accounts[0] 
          : transaction.bank_accounts;
        const currency = bankAccount?.currency || 'USD';
        
        let amountInUSD = transaction.amount || 0;

        // Convert to USD if not already
        if (currency !== 'USD') {
          const { data: converted } = await supabase.rpc('convert_currency', {
            p_amount: Math.abs(transaction.amount),
            p_from_currency: currency,
            p_to_currency: 'USD',
            p_date: transaction.transaction_date,
          });

          // Preserve the sign (positive or negative)
          amountInUSD = transaction.amount < 0 ? -(converted || Math.abs(transaction.amount)) : (converted || Math.abs(transaction.amount));
        }

        cashBalance += amountInUSD;
      }
    }

    // Calculate inventory value - ONLY IF INVENTORY MODULE ENABLED
    let inventoryValue = 0;
    if (moduleIds.includes('inventory') || moduleIds.includes('retail') || moduleIds.includes('cafe')) {
      const { data: inventoryItems } = await supabase
        .from('products')
        .select('quantity_on_hand, cost_price, currency')
        .eq('company_id', companyId)
        .eq('track_inventory', true);

      if (inventoryItems) {
        for (const item of inventoryItems) {
          const quantity = item.quantity_on_hand || 0;
          const cost = item.cost_price || 0;
          const itemValue = quantity * cost;

          if (itemValue > 0) {
            let valueInUSD = itemValue;

            if (item.currency && item.currency !== 'USD') {
              const { data: converted } = await supabase.rpc('convert_currency', {
                p_amount: itemValue,
                p_from_currency: item.currency,
                p_to_currency: 'USD',
                p_date: new Date().toISOString().split('T')[0],
              });

              valueInUSD = converted || itemValue;
            }

            inventoryValue += valueInUSD;
          }
        }
      }
    }

    const netIncome = totalRevenue - totalExpenses;

    // Return stats with conditional fields based on enabled modules
    const stats: any = {
      totalRevenue,
      totalExpenses,
      netIncome,
      accountsReceivable,
      accountsPayable,
      cashBalance,
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
