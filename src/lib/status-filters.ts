// Shared invoice/bill status filter definitions.
//
// Every SQL query that filters documents by status must reference these
// constants instead of hand-rolling its own list — inconsistent hand-rolled
// filters caused reports to silently exclude valid records (e.g. 'posted'
// invoices missing from AR aging).
//
// Statuses observed in this codebase:
//   invoices: draft, sent, posted, approved, partial, overdue, paid, void, cancelled
//   bills:    draft, pending_approval, approved, posted, partial, paid, void, cancelled

export type InvoiceStatus =
  | 'draft' | 'sent' | 'posted' | 'approved' | 'partial'
  | 'overdue' | 'paid' | 'void' | 'cancelled';

export type BillStatus =
  | 'draft' | 'pending_approval' | 'approved' | 'posted'
  | 'partial' | 'paid' | 'void' | 'cancelled';

/** Invoices with money still owed (AR aging, outstanding balances). */
export const INVOICE_OUTSTANDING_EXCLUDED = ['paid', 'void', 'cancelled', 'draft'] as const;

/** Bills with money still owed (AP aging, vendor balances). */
export const BILL_OUTSTANDING_EXCLUDED = ['paid', 'void', 'draft', 'cancelled'] as const;

/** Invoices that count as recognized revenue (tax summary, revenue reports). */
export const INVOICE_RECOGNIZED_EXCLUDED = ['draft', 'void', 'cancelled'] as const;

/** Bills that count as recognized expenses (tax summary, expense reports). */
export const BILL_RECOGNIZED_EXCLUDED = ['draft', 'void', 'cancelled'] as const;

/**
 * Render a NOT IN clause for a status column, e.g.
 *   `i.status ${sqlNotIn(INVOICE_OUTSTANDING_EXCLUDED)}`
 * Values are compile-time constants from this file — never user input.
 */
export function sqlNotIn(statuses: readonly string[]): string {
  return `NOT IN (${statuses.map((s) => `'${s}'`).join(', ')})`;
}
