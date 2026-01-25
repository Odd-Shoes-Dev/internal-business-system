import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('fixed_assets')
      .select('purchase_price, accumulated_depreciation, book_value, status')
      .eq('status', 'active');

    if (error) throw error;

    if (!data) {
      return NextResponse.json({
        totalAssets: 0,
        totalCost: 0,
        totalBookValue: 0,
        totalDepreciation: 0,
      });
    }

    const totalAssets = data.length;
    
    // Sum the values (all in USD - no currency field exists yet in fixed_assets table)
    const totalCost = data.reduce((sum, asset) => sum + (asset.purchase_price || 0), 0);
    const totalDepreciation = data.reduce((sum, asset) => sum + (asset.accumulated_depreciation || 0), 0);
    const totalBookValue = data.reduce((sum, asset) => sum + (asset.book_value || 0), 0);

    return NextResponse.json({
      totalAssets,
      totalCost,
      totalBookValue,
      totalDepreciation,
    });
  } catch (error) {
    console.error('Error calculating assets stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate assets stats' },
      { status: 500 }
    );
  }
}

