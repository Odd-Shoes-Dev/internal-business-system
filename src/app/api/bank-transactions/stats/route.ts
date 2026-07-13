import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { buildRatesMap, convertCurrency } from '@/lib/exchange-rates';

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

    const companyResult = await db.query<{ currency: string }>(
      'SELECT currency FROM companies WHERE id = $1 LIMIT 1',
      [companyId]
    );
    const baseCurrency = companyResult.rows[0]?.currency || 'USD';

    const ratesResult = await db.query<{ from_currency: string; to_currency: string; rate: number }>(
      `SELECT DISTINCT ON (from_currency, to_currency) from_currency, to_currency, rate
       FROM exchange_rates
       ORDER BY from_currency, to_currency, effective_date DESC`
    );
    const ratesMap = buildRatesMap(ratesResult.rows, baseCurrency);

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
      transaction_type: string;
      is_reconciled: boolean;
    }>(
      `SELECT amount, currency, transaction_type, is_reconciled
       FROM bank_transactions
       WHERE ${where.join(' AND ')}`,
      params
    );

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let unreconciledCount = 0;

    for (const tx of transactions.rows || []) {
      const amount = Math.abs(Number(tx.amount) || 0);
      const txCurrency = tx.currency || baseCurrency;
      const amountInBase = convertCurrency(amount, txCurrency, baseCurrency, ratesMap);

      if (tx.transaction_type === 'deposit' || tx.transaction_type === 'transfer_in') {
        totalDeposits += amountInBase;
      } else if (tx.transaction_type === 'withdrawal' || tx.transaction_type === 'transfer_out') {
        totalWithdrawals += amountInBase;
      }

      if (!tx.is_reconciled) {
        unreconciledCount++;
      }
    }

    return NextResponse.json({
      totalDeposits,
      totalWithdrawals,
      unreconciledCount,
      currency: baseCurrency,
    });
  } catch (error) {
    console.error('Error calculating bank transactions stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate bank transactions stats' },
      { status: 500 }
    );
  }
}
