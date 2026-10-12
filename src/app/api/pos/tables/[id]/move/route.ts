import { NextRequest, NextResponse } from 'next/server';
import { mergeTableCarts } from '@/lib/pos/tables';
import { loadTable } from '../../shared';

// POST /api/pos/tables/[id]/move — { to_table_id }: moves this table's order to another table;
// if that table already has an order, the two are merged there
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await loadTable(id);
    if ('error' in ctx) return ctx.error;
    const { to_table_id } = await request.json();
    if (!to_table_id || to_table_id === id) return NextResponse.json({ error: 'Choose another table' }, { status: 400 });

    const target = (await ctx.db.query<any>(
      'SELECT id, name FROM restaurant_tables WHERE id = $1 AND company_id = $2 AND is_active', [to_table_id, ctx.table.company_id]
    )).rows[0];
    if (!target) return NextResponse.json({ error: 'Table not found' }, { status: 404 });

    const result = await ctx.db.transaction(async (tx) => {
      const orders = (await tx.query<any>(
        'SELECT * FROM pos_held_orders WHERE table_id = ANY($1::uuid[]) FOR UPDATE', [[id, to_table_id]]
      )).rows;
      const from = orders.find((o) => o.table_id === id);
      const into = orders.find((o) => o.table_id === to_table_id);
      if (!from) throw new MoveError('This table has no open order');

      if (!into) {
        await tx.query('UPDATE pos_held_orders SET table_id = $2, label = $3, updated_at = NOW() WHERE id = $1', [from.id, to_table_id, target.name]);
        return { merged: false };
      }
      await tx.query(
        `UPDATE pos_held_orders SET cart = $2::jsonb, cart_discount = cart_discount + $3,
           guests = CASE WHEN guests IS NULL AND $4::int IS NULL THEN NULL ELSE COALESCE(guests, 0) + COALESCE($4::int, 0) END,
           customer_id = COALESCE(customer_id, $5), updated_at = NOW()
         WHERE id = $1`,
        [into.id, JSON.stringify(mergeTableCarts(into.cart, from.cart)), Number(from.cart_discount || 0), from.guests, from.customer_id]
      );
      await tx.query('DELETE FROM pos_held_orders WHERE id = $1', [from.id]);
      return { merged: true };
    });
    return NextResponse.json({ data: result });
  } catch (error: any) {
    if (error instanceof MoveError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

class MoveError extends Error {}
