import { NextRequest, NextResponse } from 'next/server';
import { convertCurrency, getRatesMap } from '@/lib/exchange-rates';
import { requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/currency/convert - Convert amount between currencies
export async function POST(request: NextRequest) {
  try {
    const { db, errorResponse } = await requireSessionUser();
    if (errorResponse) {
      return errorResponse;
    }

    const body = await request.json();
    const amount = Number(body.amount || 0);
    const fromCurrency = String(body.from_currency || '').toUpperCase();
    const toCurrency = String(body.to_currency || '').toUpperCase();
    const date = body.date || new Date().toISOString().split('T')[0];

    if (!fromCurrency || !toCurrency) {
      return NextResponse.json(
        { error: 'from_currency and to_currency are required' },
        { status: 400 }
      );
    }

    if (fromCurrency === toCurrency) {
      return NextResponse.json({ data: { converted_amount: amount } });
    }

    const ratesMap = await getRatesMap(db, toCurrency);
    if (!(fromCurrency in ratesMap)) {
      return NextResponse.json({ error: 'No exchange rate available' }, { status: 404 });
    }

    const converted = convertCurrency(amount, fromCurrency, toCurrency, ratesMap);
    return NextResponse.json({ data: { converted_amount: converted } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
