import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current month date range
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // Get all expenses for calculations
    const { data: allExpenses, error } = await supabase
      .from('expenses')
      .select('amount, currency, expense_date, status');

    if (error) throw error;

    let thisMonthTotal = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let paidCount = 0;

    // Process each expense with currency conversion
    for (const expense of allExpenses || []) {
      const amount = parseFloat(expense.amount) || 0;
      
      // Convert to USD if needed
      let amountUSD = amount;
      if (expense.currency && expense.currency !== 'USD') {
        const { data: converted, error: conversionError } = await supabase.rpc('convert_currency', {
          p_amount: amount,
          p_from_currency: expense.currency,
          p_to_currency: 'USD',
          p_date: expense.expense_date,
        });

        if (conversionError) {
          console.error('Currency conversion error:', conversionError);
          amountUSD = amount; // Fallback
        } else {
          amountUSD = converted || amount;
        }
      }

      // Check if this month
      if (expense.expense_date >= firstDayOfMonth && expense.expense_date <= lastDayOfMonth) {
        thisMonthTotal += amountUSD;
      }

      // Count by status
      const status = expense.status?.toLowerCase() || 'pending';
      if (status === 'pending' || status === 'pending_approval') {
        pendingCount++;
      } else if (status === 'approved') {
        approvedCount++;
      } else if (status === 'paid') {
        paidCount++;
      }
    }

    return NextResponse.json({
      thisMonth: thisMonthTotal,
      pendingApproval: pendingCount,
      approved: approvedCount,
      paid: paidCount,
    });
  } catch (error) {
    console.error('Error calculating expense stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate expense stats' },
      { status: 500 }
    );
  }
}
