import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { buildRatesMap, convertCurrency } from '@/lib/exchange-rates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const { id } = await params;

    const customer = await db.query<{ company_id: string }>(
      'SELECT company_id FROM customers WHERE id = $1 LIMIT 1',
      [id]
    );
    if (!customer.rowCount) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const companyId = customer.rows[0].company_id;
    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const [companyRow, invoices, exchangeRateRows] = await Promise.all([
      db.query<{ currency: string }>('SELECT currency FROM companies WHERE id = $1', [companyId]),
      db.query<{ total: string | number; amount_paid: string | number; currency: string; status: string }>(
        'SELECT total, amount_paid, currency, status FROM invoices WHERE customer_id = $1',
        [id]
      ),
      db.query<{ from_currency: string; to_currency: string; rate: number; effective_date: string }>(
        'SELECT from_currency, to_currency, rate, effective_date::text FROM exchange_rates ORDER BY effective_date DESC'
      ),
    ]);

    const baseCurrency = companyRow.rows[0]?.currency || 'USD';
    const ratesMap = buildRatesMap(exchangeRateRows.rows, baseCurrency);

    let totalOutstanding = 0;

    for (const invoice of invoices.rows || []) {
      if (['paid', 'void', 'cancelled'].includes(invoice.status)) continue;
      const total = Number(invoice.total) || 0;
      const paid = Number(invoice.amount_paid) || 0;
      const remaining = total - paid;
      if (remaining <= 0) continue;

      totalOutstanding += convertCurrency(remaining, invoice.currency || baseCurrency, baseCurrency, ratesMap);
    }

    return NextResponse.json({
      outstandingBalance: totalOutstanding,
      currency: baseCurrency,
    });
  } catch (error) {
    console.error('Error calculating customer balance:', error);
    return NextResponse.json({ error: 'Failed to calculate customer balance' }, { status: 500 });
  }
}
