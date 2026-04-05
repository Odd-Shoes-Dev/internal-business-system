import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;
    const stockTakeId = id;

    const stockTakeResult = await db.query(
      `SELECT id, reference_number, status, company_id
       FROM stock_takes
       WHERE id = $1
       LIMIT 1`,
      [stockTakeId]
    );

    const stockTake = stockTakeResult.rows[0];
    if (!stockTake) {
      return NextResponse.json({ error: 'Stock take not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, stockTake.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (stockTake.status === 'completed') {
      return NextResponse.json({ error: 'Stock take already completed' }, { status: 400 });
    }

    const linesResult = await db.query(
      `SELECT stl.id, stl.product_id, stl.variance
       FROM stock_take_lines stl
       INNER JOIN products p ON p.id = stl.product_id
       WHERE stl.stock_take_id = $1
         AND p.company_id = $2`,
      [stockTakeId, stockTake.company_id]
    );

    const lines = linesResult.rows || [];

    const response = await db.transaction(async (tx) => {
      await tx.query(
        `UPDATE stock_takes
         SET status = 'completed',
             approved_by = $2,
             approved_at = NOW()
         WHERE id = $1`,
        [stockTakeId, user.id]
      );

      for (const line of lines) {
        const variance = Number(line.variance || 0);
        if (variance === 0) {
          continue;
        }

        await tx.query(
          `INSERT INTO inventory_movements (
             product_id, movement_type, quantity, reference_type, reference_id, notes, created_by
           ) VALUES ($1, 'adjustment', $2, 'stock_take', $3, $4, $5)`,
          [line.product_id, variance, stockTakeId, `Stock take ${stockTake.reference_number}`, user.id]
        );

        await tx.query(
          `UPDATE products
           SET quantity_on_hand = COALESCE(quantity_on_hand, 0) + $2,
               updated_at = NOW()
           WHERE id = $1`,
          [line.product_id, variance]
        );
      }

      return {
        message: 'Stock take approved and inventory updated',
        stockTakeId,
        adjustmentsApplied: lines.filter((l: any) => Number(l.variance || 0) !== 0).length,
      };
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error approving stock take:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
