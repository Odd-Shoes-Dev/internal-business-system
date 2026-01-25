import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/assets/[id] - Get single asset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('fixed_assets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/assets/[id] - Update asset
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const {
      name,
      description,
      asset_number,
      serial_number,
      purchase_date,
      purchase_price,
      residual_value,
      useful_life_months,
      depreciation_method,
      depreciation_start_date,
      location,
      notes,
    } = body;

    // Calculate book value
    const { data: existingAsset } = await supabase
      .from('fixed_assets')
      .select('accumulated_depreciation')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('fixed_assets')
      .update({
        name,
        description: description || null,
        asset_number,
        serial_number: serial_number || null,
        purchase_date,
        purchase_price: Number(purchase_price),
        residual_value: Number(residual_value),
        useful_life_months: Number(useful_life_months),
        depreciation_method,
        depreciation_start_date,
        location: location || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating asset:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in assets PUT:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/assets/[id] - Delete asset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('fixed_assets')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Asset deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
