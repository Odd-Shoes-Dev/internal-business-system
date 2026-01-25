import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const type = searchParams.get('type');
    const reconciled = searchParams.get('reconciled');

    let query = supabase
      .from('bank_transactions')
      .select('amount, currency, transaction_date, transaction_type, is_reconciled');

    if (accountId && accountId !== 'all') {
      query = query.eq('bank_account_id', accountId);
    }

    if (type && type !== 'all') {
      query = query.eq('transaction_type', type);
    }

    if (reconciled && reconciled !== 'all') {
      query = query.eq('is_reconciled', reconciled === 'reconciled');
    }

    const { data: transactions, error } = await query;

    if (error) throw error;

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let unreconciledCount = 0;

    for (const tx of transactions || []) {
      const amount = Math.abs(parseFloat(tx.amount) || 0);
      let amountUSD = amount;

      // Convert to USD if not already
      if (tx.currency && tx.currency !== 'USD') {
        const { data: converted } = await supabase.rpc('convert_currency', {
          p_amount: amount,
          p_from_currency: tx.currency,
          p_to_currency: 'USD',
          p_date: tx.transaction_date,
        });
        amountUSD = converted || amount;
      }

      // Sum deposits and withdrawals
      if (tx.transaction_type === 'deposit') {
        totalDeposits += amountUSD;
      } else if (tx.transaction_type === 'withdrawal') {
        totalWithdrawals += amountUSD;
      }

      // Count unreconciled
      if (!tx.is_reconciled) {
        unreconciledCount++;
      }
    }

    return NextResponse.json({
      totalDeposits,
      totalWithdrawals,
      unreconciledCount,
    });
  } catch (error) {
    console.error('Error calculating bank transactions stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate bank transactions stats' },
      { status: 500 }
    );
  }
}
