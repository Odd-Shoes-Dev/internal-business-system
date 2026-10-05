import { NextRequest, NextResponse } from 'next/server';
import { loadTable } from '../../shared';

// PUT /api/pos/tables/[id]/order — save the table's open order
// { cart, cart_discount?, customer_id?, guests?, session_id? }. An empty cart clears the table.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await loadTable(id);
    if ('error' in ctx) return ctx.error;
    if (!ctx.table.is_active) return NextResponse.json({ error: 'This table was removed' }, { status: 400 });

    const body = await request.json();
    const cart = Array.isArray(body.cart) ? body.cart : [];
    if (!cart.length) {
      await ctx.db.query('DELETE FROM pos_held_orders WHERE table_id = $1', [id]);
      return NextResponse.json({ data: null });
    }
    if (body.customer_id) {
      const customer = await ctx.db.query('SELECT 1 FROM customers WHERE id = $1 AND company_id = $2', [body.customer_id, ctx.table.company_id]);
      if (!customer.rowCount) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const result = await ctx.db.query(
      `INSERT INTO pos_held_orders (company_id, session_id, label, table_id, customer_id, guests, cart, cart_discount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
       ON CONFLICT (table_id) WHERE table_id IS NOT NULL DO UPDATE SET
         cart = EXCLUDED.cart, cart_discount = EXCLUDED.cart_discount, customer_id = EXCLUDED.customer_id,
         guests = EXCLUDED.guests, session_id = COALESCE(EXCLUDED.session_id, pos_held_orders.session_id), updated_at = NOW()
       RETURNING *`,
      [ctx.table.company_id, body.session_id || null, ctx.table.name, id, body.customer_id || null,
       Number(body.guests) > 0 ? Number(body.guests) : null, JSON.stringify(cart), Number(body.cart_discount || 0), ctx.user.id]
    );
    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/pos/tables/[id]/order — clear the table (after it is charged, or the order is cancelled)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await loadTable(id);
    if ('error' in ctx) return ctx.error;
    await ctx.db.query('DELETE FROM pos_held_orders WHERE table_id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
