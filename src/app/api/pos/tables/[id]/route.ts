import { NextRequest, NextResponse } from 'next/server';
import { canManageTables, loadTable } from '../shared';

// PATCH /api/pos/tables/[id] — { name?, area?, seats?, sort_order?, is_active? }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await loadTable(id);
    if ('error' in ctx) return ctx.error;
    if (!(await canManageTables(ctx.db, ctx.user.id, ctx.table.company_id))) {
      return NextResponse.json({ error: 'Your role cannot manage tables' }, { status: 403 });
    }
    const body = await request.json();
    const next = {
      name: body.name !== undefined ? String(body.name).trim().slice(0, 50) : ctx.table.name,
      area: body.area !== undefined ? String(body.area || '').trim().slice(0, 50) || null : ctx.table.area,
      seats: body.seats !== undefined ? (Number(body.seats) > 0 ? Number(body.seats) : null) : ctx.table.seats,
      sort_order: body.sort_order !== undefined ? Number(body.sort_order) || 0 : ctx.table.sort_order,
      is_active: body.is_active !== undefined ? body.is_active !== false : ctx.table.is_active,
    };
    if (!next.name) return NextResponse.json({ error: 'Name the table' }, { status: 400 });
    const result = await ctx.db.query(
      `UPDATE restaurant_tables SET name = $2, area = $3, seats = $4, sort_order = $5, is_active = $6, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, next.name, next.area, next.seats, next.sort_order, next.is_active]
    );
    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23505') return NextResponse.json({ error: 'There is already a table with that name' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/pos/tables/[id] — removes the table from the floor (kept for history)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await loadTable(id);
    if ('error' in ctx) return ctx.error;
    if (!(await canManageTables(ctx.db, ctx.user.id, ctx.table.company_id))) {
      return NextResponse.json({ error: 'Your role cannot manage tables' }, { status: 403 });
    }
    const open = await ctx.db.query('SELECT 1 FROM pos_held_orders WHERE table_id = $1', [id]);
    if (open.rowCount) return NextResponse.json({ error: 'This table has an open order; charge or clear it first' }, { status: 400 });
    await ctx.db.query('UPDATE restaurant_tables SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
