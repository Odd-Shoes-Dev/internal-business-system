import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';
import { buildRatesMap, convertCurrency } from '@/lib/exchange-rates';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

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

    const itemsResult = await db.query(
      `SELECT quantity_on_hand, cost_price, currency, reorder_point
       FROM products
       WHERE company_id = $1
         AND track_inventory = true`,
      [companyId]
    );

    const allItems = itemsResult.rows || [];

    if (allItems.length === 0) {
      return NextResponse.json({
        totalItems: 0,
        totalValue: 0,
        lowStock: 0,
        outOfStock: 0,
        currency: baseCurrency,
      });
    }

    const totalItems = allItems.length;
    let totalValue = 0;

    for (const item of allItems as any[]) {
      const quantity = Number(item.quantity_on_hand || 0);
      const cost = Number(item.cost_price || 0);
      const itemValue = quantity * cost;

      if (itemValue > 0) {
        const itemCurrency = item.currency || baseCurrency;
        totalValue += convertCurrency(itemValue, itemCurrency, baseCurrency, ratesMap);
      }
    }

    const lowStock = allItems.filter(
      (item: any) =>
        Number(item.quantity_on_hand || 0) <= Number(item.reorder_point || 0) &&
        Number(item.quantity_on_hand || 0) > 0
    ).length;

    const outOfStock = allItems.filter(
      (item: any) => Number(item.quantity_on_hand || 0) === 0
    ).length;

    return NextResponse.json({
      totalItems,
      totalValue,
      lowStock,
      outOfStock,
      currency: baseCurrency,
    });
  } catch (error) {
    console.error('Error calculating inventory stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate inventory stats' },
      { status: 500 }
    );
  }
}
