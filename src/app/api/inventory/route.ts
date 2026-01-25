import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/inventory - List inventory items
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search');
    const lowStock = searchParams.get('low_stock');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('name');

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category_id', category);
    }

    // Apply pagination unless we need to post-filter for low stock
    if (lowStock !== 'true') {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // When filtering by low stock, compare columns in JS because PostgREST
    // lacks a simple column-to-column comparator.
    if (lowStock === 'true') {
      const filtered = (data || []).filter(
        (item: any) => (item?.quantity_on_hand ?? 0) <= (item?.reorder_point ?? 0)
      );
      const paged = filtered.slice(offset, offset + limit);

      return NextResponse.json({
        data: paged,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
      });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/inventory - Create inventory item
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    if (!body.name || !body.sku) {
      return NextResponse.json(
        { error: 'Missing required fields: name, sku' },
        { status: 400 }
      );
    }

    // Check SKU uniqueness
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('sku', body.sku)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'An item with this SKU already exists' },
        { status: 400 }
      );
    }

    // Get inventory asset account
    const { data: inventoryAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', '1300')
      .single();

    // Get COGS account
    const { data: cogsAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', '5100')
      .single();

    const { data, error } = await supabase
      .from('products')
      .insert({
        sku: body.sku,
        name: body.name,
        description: body.description || null,
        category_id: body.category_id || null,
        product_type: 'inventory',
        unit_of_measure: body.unit_of_measure || 'each',
        cost_price: body.unit_cost || 0,
        unit_price: body.unit_price || 0,
        currency: body.currency || 'USD',
        quantity_on_hand: body.quantity_on_hand || 0,
        quantity_reserved: 0,
        reorder_point: body.reorder_point || 0,
        reorder_quantity: body.reorder_quantity || 0,
        inventory_account_id: inventoryAccount?.id,
        cogs_account_id: cogsAccount?.id,
        revenue_account_id: null,
        is_active: body.is_active !== false,
        track_inventory: body.track_inventory !== false,
        is_taxable: body.is_taxable !== false,
        tax_rate: body.tax_rate || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
