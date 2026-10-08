// Stock adjustments: a request to change a product's quantity outside buying and selling
// (count corrections, damage, expiry, theft...). Nothing moves until it is approved; then
// the stock change is made at FIFO cost and posted:
//   loss:  Dr 5300 Inventory Write-offs / Cr Inventory
//   gain:  Dr Inventory / Cr 5300 Inventory Write-offs
// Companies can turn approval off (companies.settings -> inventory -> require_adjustment_approval).

import {
  getAccountIdByCode,
  insertJournalEntryWithDb,
  validatePeriodLockWithDb,
  type QueryExecutor,
} from '@/lib/accounting/provider-accounting';
import { putStockInWithDb, StockError, takeStockOutWithDb } from '@/lib/inventory/stock';

export const ADJUSTMENT_REASONS = [
  'count_correction', 'damage', 'expired', 'theft', 'spoilage', 'found', 'internal_use', 'other',
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

// Reasons that are a loss of goods (written off), as opposed to a count difference
const WRITE_OFF_REASONS: AdjustmentReason[] = ['damage', 'expired', 'theft', 'spoilage', 'internal_use'];

export const APPROVER_ROLES = ['owner', 'admin', 'accountant'];

export async function adjustmentApprovalRequiredWithDb(q: QueryExecutor, companyId: string): Promise<boolean> {
  const result = await q.query<{ required: unknown }>(
    "SELECT settings -> 'inventory' -> 'require_adjustment_approval' AS required FROM companies WHERE id = $1",
    [companyId]
  );
  return result.rows[0]?.required !== false; // on unless explicitly turned off
}

export async function canApproveAdjustmentsWithDb(q: QueryExecutor, userId: string, companyId: string): Promise<boolean> {
  const result = await q.query<{ role: string | null }>(
    'SELECT role FROM user_companies WHERE user_id = $1 AND company_id = $2 LIMIT 1',
    [userId, companyId]
  );
  return APPROVER_ROLES.includes(result.rows[0]?.role || '');
}

export async function createStockAdjustmentWithDb(
  q: QueryExecutor,
  input: {
    companyId: string;
    productId: string;
    quantityChange: number;
    reason: AdjustmentReason;
    notes?: string | null;
    userId: string;
    source?: 'manual' | 'stock_take';
    sourceId?: string | null;
  }
): Promise<{ id: string; adjustment_number: string }> {
  if (!ADJUSTMENT_REASONS.includes(input.reason)) throw new StockError('Invalid adjustment reason');
  if (!Number(input.quantityChange)) throw new StockError('Quantity change cannot be zero');

  const product = await q.query('SELECT 1 FROM products WHERE id = $1 AND company_id = $2', [input.productId, input.companyId]);
  if (!product.rowCount) throw new StockError('Product not found');

  const result = await q.query<{ id: string; adjustment_number: string }>(
    `INSERT INTO stock_adjustments (
       company_id, adjustment_number, product_id, quantity_change, reason, notes, source, source_id, requested_by
     ) VALUES ($1, 'ADJ-' || LPAD(nextval('stock_adjustment_number_seq')::TEXT, 6, '0'), $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, adjustment_number`,
    [input.companyId, input.productId, input.quantityChange, input.reason, input.notes ?? null,
     input.source ?? 'manual', input.sourceId ?? null, input.userId]
  );
  return result.rows[0];
}

export async function approveStockAdjustmentWithDb(
  q: QueryExecutor,
  adjustmentId: string,
  userId: string
): Promise<{ totalCost: number; journalEntryId: string | null }> {
  const adjResult = await q.query<any>(
    `SELECT a.*, p.inventory_account_id, p.cost_price, p.track_inventory, p.name AS product_name
     FROM stock_adjustments a JOIN products p ON p.id = a.product_id
     WHERE a.id = $1 FOR UPDATE OF a`,
    [adjustmentId]
  );
  const adj = adjResult.rows[0];
  if (!adj) throw new StockError('Adjustment not found');
  if (adj.status !== 'pending') throw new StockError(`This adjustment is already ${adj.status}`);
  if (!adj.track_inventory) throw new StockError(`${adj.product_name} does not track stock`);

  const today = new Date().toISOString().slice(0, 10);
  const periodError = await validatePeriodLockWithDb(q, today, adj.company_id);
  if (periodError) throw new StockError(periodError);

  const change = Number(adj.quantity_change);
  const writeOff = WRITE_OFF_REASONS.includes(adj.reason);
  let totalCost: number;

  if (change < 0) {
    const out = await takeStockOutWithDb(q, {
      productId: adj.product_id,
      quantity: -change,
      movementType: writeOff ? 'write_off' : 'adjustment',
      referenceType: 'stock_adjustment',
      referenceId: adj.id,
      notes: `${adj.adjustment_number}: ${adj.reason}${adj.notes ? ` - ${adj.notes}` : ''}`,
      userId,
      allowNegative: true, // the physical stock is what it is; the count was wrong
    });
    totalCost = out.totalCost;
  } else {
    const unitCost = Number(adj.cost_price || 0);
    const into = await putStockInWithDb(q, {
      productId: adj.product_id,
      quantity: change,
      unitCost,
      movementType: 'adjustment',
      referenceType: 'stock_adjustment',
      referenceId: adj.id,
      lotNumber: adj.adjustment_number,
      notes: `${adj.adjustment_number}: ${adj.reason}${adj.notes ? ` - ${adj.notes}` : ''}`,
      userId,
    });
    totalCost = into.totalCost;
  }
  totalCost = Math.round(totalCost * 100) / 100;

  let journalEntryId: string | null = null;
  if (totalCost > 0) {
    const inventoryAccount = adj.inventory_account_id || (await getAccountIdByCode(q, '1200', adj.company_id));
    const writeOffAccount = await getAccountIdByCode(q, '5300', adj.company_id);
    if (!inventoryAccount || !writeOffAccount) {
      throw new StockError('Inventory (1200) or Inventory Write-offs (5300) account not found');
    }
    const currency = (await q.query<{ currency: string }>('SELECT currency FROM companies WHERE id = $1', [adj.company_id])).rows[0]?.currency || 'USD';
    const loss = change < 0;
    const journal = await insertJournalEntryWithDb(
      q,
      { entry_date: today, description: `Stock adjustment ${adj.adjustment_number} (${adj.reason})`,
        source_module: 'stock_adjustment', source_document_id: adj.id, company_id: adj.company_id },
      [
        { account_id: loss ? writeOffAccount : inventoryAccount, debit: totalCost, credit: 0,
          description: `${adj.adjustment_number} ${adj.product_name}`, currency, exchange_rate: 1 },
        { account_id: loss ? inventoryAccount : writeOffAccount, debit: 0, credit: totalCost,
          description: `${adj.adjustment_number} ${adj.product_name}`, currency, exchange_rate: 1 },
      ],
      userId
    );
    if (!journal.success) throw new StockError(journal.error || 'Failed to post the adjustment');
    journalEntryId = journal.journalEntryId ?? null;
  }

  await q.query(
    `UPDATE stock_adjustments
     SET status = 'approved', approved_by = $2, approved_at = NOW(), unit_cost = $3, total_cost = $4,
         journal_entry_id = $5, updated_at = NOW()
     WHERE id = $1`,
    [adj.id, userId, Math.abs(change) ? totalCost / Math.abs(change) : 0, totalCost, journalEntryId]
  );

  return { totalCost, journalEntryId };
}

export async function rejectStockAdjustmentWithDb(q: QueryExecutor, adjustmentId: string, userId: string, reason?: string | null) {
  const result = await q.query(
    `UPDATE stock_adjustments
     SET status = 'rejected', approved_by = $2, approved_at = NOW(), rejection_reason = $3, updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING id`,
    [adjustmentId, userId, reason ?? null]
  );
  if (!result.rowCount) throw new StockError('Only pending adjustments can be rejected');
}
