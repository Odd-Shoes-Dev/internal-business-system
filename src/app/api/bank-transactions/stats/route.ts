import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { searchParams } = new URL(request.url);
    const companyId = getCompanyIdFromRequest(request);
    const accountId = searchParams.get('account_id');
    const type = searchParams.get('type');
    const reconciled = searchParams.get('reconciled');

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const where: string[] = ['company_id = $1'];
    const params: any[] = [companyId];

    if (accountId && accountId !== 'all') {
      params.push(accountId);
      where.push(`bank_account_id = $${params.length}`);
    }

    if (type && type !== 'all') {
      params.push(type);
      where.push(`transaction_type = $${params.length}`);
    }

    if (reconciled && reconciled !== 'all') {
      params.push(reconciled === 'reconciled');
      where.push(`is_reconciled = $${params.length}`);
    }

    const transactions = await db.query<{
      amount: number | string;
      currency: string;
      transaction_date: string;
      transaction_type: string;
      is_reconciled: boolean;
    }>(
      `SELECT amount, currency, transaction_date, transaction_type, is_reconciled
       FROM bank_transactions
       WHERE ${where.join(' AND ')}`,
      params
    );

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let unreconciledCount = 0;

    for (const tx of transactions.rows || []) {
      const amount = Math.abs(Number(tx.amount) || 0);
      let amountUSD = amount;

      // Convert to USD if not already
      if (tx.currency && tx.currency !== 'USD') {
        const converted = await db.query<{ converted: number | null }>(
          'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
          [amount, tx.currency, 'USD', tx.transaction_date]
        );
        amountUSD = converted.rows[0]?.converted || amount;
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
