import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: allItems, error } = await supabase
      .from('products')
      .select('quantity_on_hand, cost_price, currency, reorder_point')
      .eq('track_inventory', true);

    if (error) throw error;

    if (!allItems) {
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
    for (const item of allItems) {
      const quantity = item.quantity_on_hand || 0;
      const cost = item.cost_price || 0;
      const itemValue = quantity * cost;

      if (itemValue > 0) {
        let valueInUSD = itemValue;

        // Convert to USD if not already
        if (item.currency && item.currency !== 'USD') {
          const { data: converted, error: conversionError } = await supabase.rpc('convert_currency', {
            p_amount: itemValue,
            p_from_currency: item.currency,
            p_to_currency: 'USD',
            p_date: new Date().toISOString().split('T')[0],
          });

          if (conversionError) {
            console.error('Currency conversion error:', conversionError);
            valueInUSD = itemValue; // Fallback
          } else {
            valueInUSD = converted || itemValue;
          }
        }

        totalValue += valueInUSD;
      }
    }

    const lowStock = allItems.filter(
      item => (item.quantity_on_hand || 0) <= (item.reorder_point || 0) && (item.quantity_on_hand || 0) > 0
    ).length;
    
    const outOfStock = allItems.filter(item => (item.quantity_on_hand || 0) === 0).length;

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
