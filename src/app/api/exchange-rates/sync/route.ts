import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';

const FREE_API_URL = 'https://open.er-api.com/v6/latest/USD';

// Currencies the platform cares about
const TRACKED_CURRENCIES = ['USD', 'EUR', 'GBP', 'UGX', 'KES', 'TZS', 'ZAR', 'NGN', 'GHS', 'ETB', 'RWF'];

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const response = await fetch(FREE_API_URL, { next: { revalidate: 0 } });
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch exchange rates from API' }, { status: 502 });
    }

    const data = await response.json();
    if (data.result !== 'success') {
      return NextResponse.json({ error: 'Exchange rate API returned error', detail: data }, { status: 502 });
    }

    const rates: Record<string, number> = data.rates;
    const today = new Date().toISOString().split('T')[0];
    let inserted = 0;

    for (const currency of TRACKED_CURRENCIES) {
      if (currency === 'USD') continue;
      const usdToCurrency = rates[currency];
      if (!usdToCurrency) continue;

      const currencyToUSD = 1 / usdToCurrency;

      // USD → currency
      await db.query(
        `INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, source)
         VALUES ($1, $2, $3, $4, 'open.er-api.com')
         ON CONFLICT (from_currency, to_currency, effective_date)
         DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source`,
        ['USD', currency, usdToCurrency, today]
      );

      // currency → USD
      await db.query(
        `INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, source)
         VALUES ($1, $2, $3, $4, 'open.er-api.com')
         ON CONFLICT (from_currency, to_currency, effective_date)
         DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source`,
        [currency, 'USD', currencyToUSD, today]
      );

      inserted += 2;
    }

    return NextResponse.json({ success: true, rates_updated: inserted, date: today });
  } catch (error: any) {
    console.error('[exchange-rates/sync] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — check if rates are stale (> 24 hours since last sync)
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const result = await db.query(
      `SELECT effective_date FROM exchange_rates
       WHERE source = 'open.er-api.com'
       ORDER BY effective_date DESC
       LIMIT 1`
    );

    const lastSync = result.rows[0]?.effective_date || null;
    const today = new Date().toISOString().split('T')[0];
    const isStale = !lastSync || lastSync < today;

    return NextResponse.json({ lastSync, isStale, today });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
