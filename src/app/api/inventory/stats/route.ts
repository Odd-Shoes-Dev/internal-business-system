import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

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
      });
    }

    const totalItems = allItems.length;
    let totalValue = 0;

    // Convert each item's value to USD
    for (const item of allItems as any[]) {
      const quantity = Number(item.quantity_on_hand || 0);
      const cost = Number(item.cost_price || 0);
      const itemValue = quantity * cost;

      if (itemValue > 0) {
        let valueInUSD = itemValue;

        // Convert to USD if not already
        if (item.currency && item.currency !== 'USD') {
          const conversionResult = await db.query(
            'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
            [itemValue, item.currency, 'USD', new Date().toISOString().split('T')[0]]
          );
          const converted = conversionResult.rows[0]?.converted;

          valueInUSD = Number(converted || itemValue);
        }

        totalValue += valueInUSD;
      }
    }

    const lowStock = allItems.filter(
      (item: any) => Number(item.quantity_on_hand || 0) <= Number(item.reorder_point || 0) && Number(item.quantity_on_hand || 0) > 0
    ).length;

    const outOfStock = allItems.filter((item: any) => Number(item.quantity_on_hand || 0) === 0).length;

    return NextResponse.json({
      totalItems,
      totalValue,
      lowStock,
      outOfStock,
    });
  } catch (error) {
    console.error('Error calculating inventory stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate inventory stats' },
      { status: 500 }
    );
  }
}
