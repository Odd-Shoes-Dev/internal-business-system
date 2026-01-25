import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/inventory/[id]/adjust - Adjust inventory quantity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    if (!body.adjustment_type || body.quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: adjustment_type, quantity' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current product
    const { data: item, error: itemError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (itemError) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Calculate new quantity
    let newQuantity = item.quantity_on_hand;
    let movementQuantity = body.quantity;

    switch (body.adjustment_type) {
      case 'add':
      case 'receive':
      case 'return':
        newQuantity += body.quantity;
        break;
      case 'remove':
      case 'sell':
      case 'damage':
      case 'shrinkage':
        if (body.quantity > item.quantity_on_hand) {
          return NextResponse.json(
            { error: 'Insufficient quantity on hand' },
            { status: 400 }
          );
        }
        newQuantity -= body.quantity;
        movementQuantity = -body.quantity;
        break;
      case 'adjustment':
        newQuantity = body.quantity;
        movementQuantity = body.quantity - item.quantity_on_hand;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid adjustment type' },
          { status: 400 }
        );
    }

    // Create movement record
    const { data: movement, error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: id,
        movement_type: body.adjustment_type,
        quantity: movementQuantity,
        unit_cost: body.unit_cost || item.cost_price,
        notes: body.notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (movementError) {
      return NextResponse.json({ error: movementError.message }, { status: 400 });
    }

    // Update product quantity
    const { data: updatedItem, error: updateError } = await supabase
      .from('products')
      .update({
        quantity_on_hand: newQuantity,
        cost_price: body.update_cost ? body.unit_cost : item.cost_price,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      data: {
        item: updatedItem,
        movement,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/inventory/[id]/movements - Get movement history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabase
      .from('inventory_movements')
      .select('*', { count: 'exact' })
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
