import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// DELETE /api/pos/held-orders/[id] — remove a parked cart (after resuming or discarding it)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await params;
    const existing = await db.query<{ company_id: string }>('SELECT company_id FROM pos_held_orders WHERE id = $1', [id]);
    const row = existing.rows[0];
    if (!row) return NextResponse.json({ error: 'Held order not found' }, { status: 404 });

    const accessError = await requireCompanyAccess(user.id, row.company_id);
    if (accessError) return accessError;

    await db.query('DELETE FROM pos_held_orders WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Held order removed' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
