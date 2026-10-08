// Every change to stock goes through these two functions, so quantities, batches (lots),
// movement history and costs always agree:
//   takeStockOutWithDb - sales, write-offs, negative adjustments: consumes lots, earliest expiry
//                        first then oldest received (FIFO), and returns what the stock cost
//   putStockInWithDb   - receiving, returns, positive adjustments: adds a lot at a cost
// Neither posts to the ledger; callers post the entry that fits the transaction.

import { allocateFifo, type CostLot } from '@/lib/accounting/inventory-costing';
import type { QueryExecutor } from '@/lib/accounting/provider-accounting';

export interface StockOutResult {
  tracked: boolean; // false for services / untracked items: nothing moved
  quantity: number;
  totalCost: number;
  unitCost: number;
}

export async function takeStockOutWithDb(
  q: QueryExecutor,
  input: {
    productId: string;
    quantity: number; // positive amount to remove
    movementType: 'sale' | 'write_off' | 'adjustment' | 'transfer' | 'requisition';
    referenceType: string;
    referenceId: string | null;
    notes?: string | null;
    userId: string;
    allowNegative?: boolean; // let on-hand go below zero instead of refusing
  }
): Promise<StockOutResult> {
  const quantity = Number(input.quantity || 0);
  const productResult = await q.query<{
    track_inventory: boolean;
    quantity_on_hand: string;
    quantity_reserved: string | null;
    cost_price: string | null;
    name: string;
  }>(
    `SELECT track_inventory, quantity_on_hand, quantity_reserved, cost_price, name
     FROM products WHERE id = $1 LIMIT 1 FOR UPDATE`,
    [input.productId]
  );
  const product = productResult.rows[0];
  if (!product) throw new StockError('Product not found');
  if (!product.track_inventory || quantity <= 0) {
    return { tracked: false, quantity: 0, totalCost: 0, unitCost: 0 };
  }

  const onHand = Number(product.quantity_on_hand || 0);
  const available = onHand - Number(product.quantity_reserved || 0);
  if (!input.allowNegative && available < quantity) {
    throw new StockError(`Insufficient stock for ${product.name}. Available: ${available}, required: ${quantity}`);
  }

  const lots = await q.query<CostLot>(
    `SELECT id, quantity_remaining, unit_cost
     FROM inventory_lots
     WHERE product_id = $1 AND quantity_remaining > 0
     ORDER BY expiry_date ASC NULLS LAST, received_date ASC, created_at ASC
     FOR UPDATE`,
    [input.productId]
  );
  const fifo = allocateFifo(lots.rows, quantity, Number(product.cost_price || 0));

  for (const allocation of fifo.allocations) {
    await q.query('UPDATE inventory_lots SET quantity_remaining = quantity_remaining - $2 WHERE id = $1', [
      allocation.lot_id,
      allocation.quantity,
    ]);
  }

  await q.query('UPDATE products SET quantity_on_hand = $2, updated_at = NOW() WHERE id = $1', [
    input.productId,
    onHand - quantity,
  ]);

  const unitCost = fifo.totalCost / quantity;
  await q.query(
    `INSERT INTO inventory_movements (
       product_id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, notes, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [input.productId, input.movementType, -quantity, unitCost, fifo.totalCost, input.referenceType,
     input.referenceId, input.notes ?? null, input.userId]
  );

  return { tracked: true, quantity, totalCost: fifo.totalCost, unitCost };
}

export async function putStockInWithDb(
  q: QueryExecutor,
  input: {
    productId: string;
    quantity: number; // positive amount to add, in stock units
    unitCost: number;
    movementType: 'purchase' | 'return' | 'adjustment' | 'transfer';
    referenceType: string;
    referenceId: string | null;
    lotNumber?: string | null;
    expiryDate?: string | null;
    manufactureDate?: string | null;
    goodsReceiptId?: string | null;
    notes?: string | null;
    userId: string;
    updateAverageCost?: boolean; // purchases move the product's average cost; returns do not
  }
): Promise<{ tracked: boolean; lotId: string | null; totalCost: number }> {
  const quantity = Number(input.quantity || 0);
  const productResult = await q.query<{ track_inventory: boolean; quantity_on_hand: string; cost_price: string | null }>(
    'SELECT track_inventory, quantity_on_hand, cost_price FROM products WHERE id = $1 LIMIT 1 FOR UPDATE',
    [input.productId]
  );
  const product = productResult.rows[0];
  if (!product) throw new StockError('Product not found');
  if (!product.track_inventory || quantity <= 0) return { tracked: false, lotId: null, totalCost: 0 };

  const onHand = Number(product.quantity_on_hand || 0);
  const unitCost = Number(input.unitCost || 0);
  const totalCost = Math.round(unitCost * quantity * 100) / 100;

  // Weighted average of what is on hand and what arrived; FIFO lots keep exact costs, this
  // average is the fallback for stock that has no lot (opening balances, old data)
  let costPrice = Number(product.cost_price || 0);
  if (input.updateAverageCost) {
    const newQty = onHand + quantity;
    costPrice = onHand > 0 && newQty > 0 ? (onHand * costPrice + quantity * unitCost) / newQty : unitCost;
  }

  await q.query('UPDATE products SET quantity_on_hand = $2, cost_price = $3, updated_at = NOW() WHERE id = $1', [
    input.productId,
    onHand + quantity,
    costPrice,
  ]);

  await q.query(
    `INSERT INTO inventory_movements (
       product_id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, notes, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [input.productId, input.movementType, quantity, unitCost, totalCost, input.referenceType, input.referenceId,
     input.notes ?? null, input.userId]
  );

  const lot = await q.query<{ id: string }>(
    `INSERT INTO inventory_lots (
       product_id, lot_number, quantity_received, quantity_remaining, unit_cost, received_date,
       expiry_date, manufacture_date, goods_receipt_id
     ) VALUES ($1, $2, $3, $3, $4, CURRENT_DATE, $5::date, $6::date, $7)
     RETURNING id`,
    [input.productId, input.lotNumber || null, quantity, unitCost, input.expiryDate || null,
     input.manufactureDate || null, input.goodsReceiptId || null]
  );

  return { tracked: true, lotId: lot.rows[0]?.id ?? null, totalCost };
}

export class StockError extends Error {}

// Stock a product starts with when it is created: a batch at the given cost, posted
//   Dr Inventory / Cr 3050 Opening Balance Equity
export async function receiveOpeningStockWithDb(
  q: QueryExecutor,
  input: { companyId: string; productId: string; quantity: number; unitCost: number; userId: string }
): Promise<void> {
  const { getAccountIdByCode, insertJournalEntryWithDb } = await import('@/lib/accounting/provider-accounting');
  const result = await putStockInWithDb(q, {
    productId: input.productId,
    quantity: input.quantity,
    unitCost: input.unitCost,
    movementType: 'adjustment',
    referenceType: 'opening_stock',
    referenceId: input.productId,
    lotNumber: 'OPENING',
    notes: 'Opening stock',
    userId: input.userId,
  });
  if (!result.tracked || result.totalCost <= 0) return;

  const product = await q.query<{ inventory_account_id: string | null; name: string }>(
    'SELECT inventory_account_id, name FROM products WHERE id = $1', [input.productId]
  );
  const inventory = product.rows[0]?.inventory_account_id || (await getAccountIdByCode(q, '1200', input.companyId));
  const equity = await getAccountIdByCode(q, '3050', input.companyId);
  if (!inventory || !equity) throw new StockError('Inventory (1200) or Opening Balance Equity (3050) account not found');
  const currency = (await q.query<{ currency: string }>('SELECT currency FROM companies WHERE id = $1', [input.companyId])).rows[0]?.currency || 'USD';

  const journal = await insertJournalEntryWithDb(
    q,
    { entry_date: new Date().toISOString().slice(0, 10), description: `Opening stock - ${product.rows[0]?.name}`,
      source_module: 'opening_stock', source_document_id: input.productId, company_id: input.companyId },
    [
      { account_id: inventory, debit: result.totalCost, credit: 0, description: 'Opening stock', currency, exchange_rate: 1 },
      { account_id: equity, debit: 0, credit: result.totalCost, description: 'Opening stock', currency, exchange_rate: 1 },
    ],
    input.userId
  );
  if (!journal.success) throw new StockError(journal.error || 'Failed to post opening stock');
}
