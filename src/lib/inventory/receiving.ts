// Accepting a goods receipt is the one way purchased stock enters the system: each line
// becomes a batch (lot) with its cost, expiry and lot number, and the ledger gets
//   Dr Inventory (the product's account, else 1200)
//   Cr 2150 Goods Received Not Invoiced
// The supplier's bill later debits 2150 and credits Accounts Payable.

import {
  getAccountIdByCode,
  insertJournalEntryWithDb,
  validatePeriodLockWithDb,
  type QueryExecutor,
} from '@/lib/accounting/provider-accounting';
import type { JournalLine } from '@/lib/accounting/inventory-costing';
import { putStockInWithDb, StockError } from '@/lib/inventory/stock';

export interface ReceiptLineInput {
  purchase_order_line_id?: string | null;
  product_id?: string | null;
  description?: string | null;
  // Either quantity_received (stock units), or purchase_quantity in the supplier's unit with
  // units_per_purchase_unit (e.g. 2 cartons x 24)
  quantity_received?: number | null;
  purchase_quantity?: number | null;
  purchase_unit?: string | null;
  units_per_purchase_unit?: number | null;
  // Either unit_cost per stock unit, or purchase_unit_cost per supplier unit
  unit_cost?: number | null;
  purchase_unit_cost?: number | null;
  lot_number?: string | null;
  expiry_date?: string | null;
  manufacture_date?: string | null;
}

// Stock-unit quantity and cost of a receipt line, converting from the purchase unit if given
export function normalizeReceiptLine(line: ReceiptLineInput) {
  const factor = Number(line.units_per_purchase_unit) > 0 ? Number(line.units_per_purchase_unit) : 1;
  const hasPurchaseQty = line.purchase_quantity != null && line.purchase_quantity !== ('' as any);
  const quantity = hasPurchaseQty ? Number(line.purchase_quantity) * factor : Number(line.quantity_received || 0);
  const unitCost = line.purchase_unit_cost != null && line.purchase_unit_cost !== ('' as any)
    ? Number(line.purchase_unit_cost) / factor
    : Number(line.unit_cost || 0);
  return {
    quantity: Math.round(quantity * 10000) / 10000,
    unitCost: Math.round(unitCost * 10000) / 10000,
    purchaseQuantity: hasPurchaseQty ? Number(line.purchase_quantity) : null,
    factor: hasPurchaseQty ? factor : null,
  };
}

export async function acceptGoodsReceiptWithDb(
  q: QueryExecutor,
  goodsReceiptId: string,
  userId: string
): Promise<{ journalEntryId: string | null; totalCost: number }> {
  const grResult = await q.query<any>('SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE', [goodsReceiptId]);
  const gr = grResult.rows[0];
  if (!gr) throw new StockError('Goods receipt not found');
  if (gr.status === 'accepted') throw new StockError('This receipt was already accepted');
  if (gr.status === 'rejected' || gr.status === 'returned') throw new StockError(`A ${gr.status} receipt cannot be accepted`);

  const receivedDate = String(gr.received_date instanceof Date ? gr.received_date.toISOString() : gr.received_date).slice(0, 10);
  const periodError = await validatePeriodLockWithDb(q, receivedDate, gr.company_id);
  if (periodError) throw new StockError(periodError);

  const lines = await q.query<any>(
    `SELECT grl.*, p.inventory_account_id, p.track_inventory
     FROM goods_receipt_lines grl
     LEFT JOIN products p ON p.id = grl.product_id
     WHERE grl.goods_receipt_id = $1
     ORDER BY grl.created_at`,
    [goodsReceiptId]
  );

  const costByAccount = new Map<string, number>();
  const defaultInventory = await getAccountIdByCode(q, '1200', gr.company_id);
  let totalCost = 0;

  for (const line of lines.rows) {
    if (line.product_id) {
      const result = await putStockInWithDb(q, {
        productId: line.product_id,
        quantity: Number(line.quantity_received),
        unitCost: Number(line.unit_cost),
        movementType: 'purchase',
        referenceType: 'goods_receipt',
        referenceId: goodsReceiptId,
        lotNumber: line.lot_number || gr.receipt_number,
        expiryDate: line.expiry_date,
        manufactureDate: line.manufacture_date,
        goodsReceiptId,
        notes: `Goods receipt ${gr.receipt_number}`,
        userId,
        updateAverageCost: true,
      });
      if (result.tracked) {
        if (result.lotId) await q.query('UPDATE goods_receipt_lines SET lot_id = $2 WHERE id = $1', [line.id, result.lotId]);
        const account = line.inventory_account_id || defaultInventory;
        if (!account) throw new StockError('Inventory account (1200) not found');
        costByAccount.set(account, (costByAccount.get(account) || 0) + result.totalCost);
        totalCost += result.totalCost;
      }
    }

    if (line.po_line_id) {
      await q.query(
        'UPDATE purchase_order_lines SET quantity_received = COALESCE(quantity_received, 0) + $2 WHERE id = $1',
        [line.po_line_id, Number(line.quantity_received)]
      );
    }
  }

  let journalEntryId: string | null = null;
  totalCost = Math.round(totalCost * 100) / 100;
  if (totalCost > 0) {
    const grni = await getAccountIdByCode(q, '2150', gr.company_id);
    if (!grni) throw new StockError('Goods Received Not Invoiced account (2150) not found');
    const currency = (await q.query<{ currency: string }>('SELECT currency FROM companies WHERE id = $1', [gr.company_id])).rows[0]?.currency || 'USD';

    const journalLines: JournalLine[] = [...costByAccount.entries()].map(([account, cost]) => ({
      account_id: account, debit: Math.round(cost * 100) / 100, credit: 0,
      description: `Stock received - ${gr.receipt_number}`, currency, exchange_rate: 1,
    }));
    journalLines.push({
      account_id: grni, debit: 0, credit: journalLines.reduce((s, l) => s + l.debit, 0),
      description: `Received, not yet billed - ${gr.receipt_number}`, currency, exchange_rate: 1,
    });

    const journal = await insertJournalEntryWithDb(
      q,
      { entry_date: receivedDate, description: `Goods receipt ${gr.receipt_number}`, source_module: 'goods_receipt',
        source_document_id: goodsReceiptId, company_id: gr.company_id },
      journalLines,
      userId
    );
    if (!journal.success) throw new StockError(journal.error || 'Failed to post the goods receipt');
    journalEntryId = journal.journalEntryId ?? null;
  }

  await q.query(
    `UPDATE goods_receipts
     SET status = 'accepted', accepted_at = NOW(), accepted_by = $2, journal_entry_id = $3, updated_at = NOW()
     WHERE id = $1`,
    [goodsReceiptId, userId, journalEntryId]
  );

  // Purchase order: received once every line has arrived in full
  if (gr.purchase_order_id) {
    const outstanding = await q.query<{ open: string }>(
      `SELECT COUNT(*) AS open FROM purchase_order_lines
       WHERE purchase_order_id = $1 AND COALESCE(quantity_received, 0) < COALESCE(quantity, 0)`,
      [gr.purchase_order_id]
    );
    const fullyReceived = Number(outstanding.rows[0]?.open || 0) === 0;
    await q.query(
      `UPDATE purchase_orders
       SET status = $2::varchar, received_date = CASE WHEN $2::varchar = 'received' THEN $3::date ELSE received_date END,
           received_by = CASE WHEN $2::varchar = 'received' THEN $4::uuid ELSE received_by END, updated_at = NOW()
       WHERE id = $1`,
      [gr.purchase_order_id, fullyReceived ? 'received' : 'partially_received', receivedDate, userId]
    );
  }

  return { journalEntryId, totalCost };
}
