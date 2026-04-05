import { NextRequest, NextResponse } from 'next/server';
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

    const conversion = await db.query<{ converted: number | null }>(
      'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
      [amount, fromCurrency, toCurrency, date]
    );

    const converted = conversion.rows[0]?.converted;
    if (converted === null || converted === undefined) {
      return NextResponse.json({ error: 'No exchange rate available' }, { status: 404 });
    }

    return NextResponse.json({ data: { converted_amount: Number(converted) } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
