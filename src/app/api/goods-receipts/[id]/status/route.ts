import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { status, inspection_notes } = await request.json();
    const { id } = await params;

    const grResult = await db.query('SELECT * FROM goods_receipts WHERE id = $1 LIMIT 1', [id]);
    const gr = grResult.rows[0];

    if (!gr) {
      return NextResponse.json({ error: 'Goods receipt not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, gr.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    await db.query(
      `UPDATE goods_receipts
       SET status = $2,
           inspection_notes = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [id, status, inspection_notes ?? null]
    );

    if (status === 'accepted') {
      const linesResult = await db.query('SELECT * FROM goods_receipt_lines WHERE goods_receipt_id = $1', [id]);

      for (const line of linesResult.rows || []) {
        if (!line.product_id) {
          continue;
        }

        const productResult = await db.query('SELECT quantity_on_hand FROM products WHERE id = $1 LIMIT 1', [line.product_id]);
        const currentQty = Number(productResult.rows[0]?.quantity_on_hand || 0);
        const newQty = currentQty + Number(line.quantity_received || 0);

        await db.query('UPDATE products SET quantity_on_hand = $2, updated_at = NOW() WHERE id = $1', [line.product_id, newQty]);

        await db.query(
          `INSERT INTO inventory_movements (
             product_id, movement_type, quantity, unit_cost,
             total_cost, reference_type, reference_id, notes, created_by
           ) VALUES ($1, 'purchase', $2, $3, $4, 'goods_receipt', $5, $6, $7)`,
          [
            line.product_id,
            Number(line.quantity_received || 0),
            Number(line.unit_cost || 0),
            Number(line.quantity_received || 0) * Number(line.unit_cost || 0),
            id,
            `Goods Receipt ${gr.receipt_number}`,
            user.id,
          ]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating goods receipt status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
