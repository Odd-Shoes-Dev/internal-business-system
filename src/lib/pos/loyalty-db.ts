import type { QueryExecutor } from '@/lib/accounting/provider-accounting';

// Records a loyalty change and updates the customer's balance (never below zero).
// Returns the new balance.
export async function recordLoyaltyWithDb(
  q: QueryExecutor,
  input: {
    companyId: string;
    customerId: string;
    points: number; // positive = earn, negative = redeem / reverse
    type: 'earn' | 'redeem' | 'reverse' | 'adjust';
    invoiceId?: string | null;
    returnId?: string | null;
    notes?: string | null;
    userId: string;
  }
): Promise<number> {
  if (!input.points) {
    const current = await q.query<{ loyalty_points: string }>('SELECT loyalty_points FROM customers WHERE id = $1', [input.customerId]);
    return Number(current.rows[0]?.loyalty_points || 0);
  }

  await q.query(
    `INSERT INTO loyalty_transactions (company_id, customer_id, invoice_id, return_id, points, type, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [input.companyId, input.customerId, input.invoiceId ?? null, input.returnId ?? null, input.points, input.type,
     input.notes ?? null, input.userId]
  );
  const updated = await q.query<{ loyalty_points: string }>(
    `UPDATE customers SET loyalty_points = GREATEST(0, loyalty_points + $2), updated_at = NOW()
     WHERE id = $1 RETURNING loyalty_points`,
    [input.customerId, input.points]
  );
  return Number(updated.rows[0]?.loyalty_points || 0);
}

// Customers' current_balance is kept by several triggers that do not agree for POS sales;
// recompute it from open invoices after a POS write.
export async function recalculateCustomerBalanceWithDb(q: QueryExecutor, customerId: string | null | undefined) {
  if (!customerId) return;
  await q.query('UPDATE customers SET current_balance = calculate_customer_balance($1) WHERE id = $1', [customerId]);
}
