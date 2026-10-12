import { NextRequest, NextResponse } from 'next/server';
import { approveStockAdjustmentWithDb, createStockAdjustmentWithDb } from '@/lib/inventory/adjustments';
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

        // The count is the approval: file each difference as an approved adjustment, which moves
        // stock at FIFO cost and posts the gain or loss to the ledger
        const adj = await createStockAdjustmentWithDb(tx, {
          companyId: stockTake.company_id,
          productId: line.product_id,
          quantityChange: variance,
          reason: 'count_correction',
          notes: `Stock take ${stockTake.reference_number}`,
          userId: user.id,
          source: 'stock_take',
          sourceId: stockTakeId,
        });
        await approveStockAdjustmentWithDb(tx, adj.id, user.id);
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
