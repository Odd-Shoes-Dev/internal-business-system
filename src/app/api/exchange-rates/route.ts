import { NextRequest, NextResponse } from 'next/server';
import { fetchExchangeRates, SUPPORTED_CURRENCIES } from '@/lib/currency';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

async function resolveCompanyId(db: any, userId: string, request: NextRequest): Promise<string | null> {
  const requested = getCompanyIdFromRequest(request);
  if (requested) {
    return requested;
  }

  const userCompany = await db.query(
    `SELECT company_id
     FROM user_companies
     WHERE user_id = $1
     ORDER BY is_primary DESC, joined_at ASC
     LIMIT 1`,
    [userId]
  );

  return userCompany.rows[0]?.company_id || null;
}

// GET /api/exchange-rates - Fetch latest exchange rates
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const companyId = await resolveCompanyId(db, user.id, request);
    if (!companyId) {
      return NextResponse.json({ error: 'No company found for user' }, { status: 403 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const result = await db.query(
      `SELECT *
       FROM exchange_rates
       ORDER BY effective_date DESC
       LIMIT 100`
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    console.error('Error fetching exchange rates:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/exchange-rates - Update exchange rates from API
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const companyId = await resolveCompanyId(db, user.id, request);
    if (!companyId) {
      return NextResponse.json({ error: 'No company found for user' }, { status: 403 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const rates = await fetchExchangeRates('USD');
    if (!rates) {
      return NextResponse.json({ error: 'Failed to update exchange rates' }, { status: 500 });
    }

    const today = new Date().toISOString().split('T')[0];

    await db.transaction(async (tx) => {
      for (const currency of Object.keys(SUPPORTED_CURRENCIES)) {
        if (currency === 'USD' || !rates[currency]) {
          continue;
        }

        await tx.query(
          `INSERT INTO exchange_rates (
             from_currency, to_currency, rate, effective_date, source
           ) VALUES ('USD', $1, $2, $3::date, $4)
           ON CONFLICT (from_currency, to_currency, effective_date)
           DO UPDATE SET
             rate = EXCLUDED.rate,
             source = EXCLUDED.source,
             updated_at = NOW()`,
          [currency, rates[currency], today, 'exchangerate-api.com']
        );

        await tx.query(
          `INSERT INTO exchange_rates (
             from_currency, to_currency, rate, effective_date, source
           ) VALUES ($1, 'USD', $2, $3::date, $4)
           ON CONFLICT (from_currency, to_currency, effective_date)
           DO UPDATE SET
             rate = EXCLUDED.rate,
             source = EXCLUDED.source,
             updated_at = NOW()`,
          [currency, 1 / rates[currency], today, 'exchangerate-api.com']
        );
      }
    });

    const updated = await db.query(
      `SELECT *
       FROM exchange_rates
       WHERE effective_date = $1::date
       ORDER BY from_currency`,
      [today]
    );

    return NextResponse.json({
      success: true,
      message: 'Exchange rates updated successfully',
      data: updated.rows,
    });
  } catch (error: any) {
    console.error('Error updating exchange rates:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
