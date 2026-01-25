import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');

    let query = supabase
      .from('fixed_assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching assets:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in assets GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      name,
      description,
      category_id,
      asset_number,
      serial_number,
      purchase_date,
      purchase_price,
      residual_value,
      useful_life_months,
      depreciation_start_date,
      depreciation_method,
      location,
      notes,
      vendor_id,
    } = body;

    const generatedNumber = asset_number || `ASSET-${Date.now().toString().slice(-6)}`;
    const purchasePrice = Number(purchase_price) || 0;
    const salvageValue = Number(residual_value) || 0;

    const { data, error } = await supabase
      .from('fixed_assets')
      .insert([
        {
          name,
          description,
          category_id: category_id || null,
          asset_number: generatedNumber,
          serial_number,
          purchase_date,
          purchase_price: purchasePrice,
          residual_value: salvageValue,
          depreciation_start_date: depreciation_start_date || purchase_date,
          useful_life_months,
          depreciation_method,
          accumulated_depreciation: 0,
          location,
          vendor_id: vendor_id || null,
          notes,
          status: 'active',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating asset:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in assets POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
