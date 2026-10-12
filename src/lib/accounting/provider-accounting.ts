import { getExchangeRate, getRatesMap } from '@/lib/exchange-rates';
import type { DbProvider } from '@/lib/provider/types';
import {
  allocateFifo,
  buildInvoiceJournalLines,
  depositAccountCodeForMethod,
  journalTotals,
  type CogsGroup,
  type CostLot,
  type JournalLine,
} from '@/lib/accounting/inventory-costing';
import { putStockInWithDb, takeStockOutWithDb } from '@/lib/inventory/stock';

type QueryResult<T = any> = { rows: T[]; rowCount: number };

export interface QueryExecutor {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
}

export function asQueryExecutor(db: DbProvider): QueryExecutor {
  return {
    query: (text, params) => db.query(text, params),
  };
}

export async function validatePeriodLockWithDb(
  q: QueryExecutor,
  transactionDate: string | Date,
  companyId: string
): Promise<string | null> {
  const dateText = typeof transactionDate === 'string' ? transactionDate : transactionDate.toISOString().split('T')[0];

  const period = await q.query<{
    name: string;
    start_date: string;
    end_date: string;
    status: string;
    level: string;
  }>(
    `SELECT name, start_date, end_date, status, level
     FROM fiscal_periods
     WHERE company_id = $1
       AND start_date <= $2::date
       AND end_date >= $2::date
       AND status IN ('closed', 'locked')
     ORDER BY level DESC
     LIMIT 1`,
    [companyId, dateText]
  );

  if (!period.rowCount) {
    return null;
  }

  const found = period.rows[0];
  return `Cannot modify transaction: The ${found.level} period "${found.name}" (${found.start_date} to ${found.end_date}) is ${found.status}.`;
}

export async function getAccountIdByCode(q: QueryExecutor, code: string, companyId: string): Promise<string | null> {
  const result = await q.query<{ id: string }>('SELECT id FROM accounts WHERE code = $1 AND company_id = $2 LIMIT 1', [code, companyId]);
  return result.rows[0]?.id ?? null;
}

export async function getBaseCurrencyAndRate(
  q: QueryExecutor,
  currency: string,
  companyId: string
): Promise<{ baseCurrency: string; exchangeRate: number }> {
  const companyRow = await q.query<{ currency: string }>(
    'SELECT currency FROM companies WHERE id = $1',
    [companyId]
  );
  const baseCurrency = companyRow.rows[0]?.currency || 'USD';
  if (!currency || currency === baseCurrency) return { baseCurrency, exchangeRate: 1 };
  const ratesMap = await getRatesMap(q, baseCurrency);
  return { baseCurrency, exchangeRate: getExchangeRate(currency, baseCurrency, ratesMap) };
}

async function getExchangeRateToBase(q: QueryExecutor, currency: string, companyId: string): Promise<number> {
  return (await getBaseCurrencyAndRate(q, currency, companyId)).exchangeRate;
}

// Writes a posted journal entry and its lines. Refuses an entry whose base-currency
// debits and credits differ.
export async function insertJournalEntryWithDb(
  q: QueryExecutor,
  header: {
    entry_date: string;
    description: string;
    source_module: string;
    source_document_id: string;
    company_id: string;
  },
  lines: JournalLine[],
  createdBy: string
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  const totals = journalTotals(lines);
  if (!totals.balanced) {
    return { success: false, error: `Journal entry not balanced. Debits: ${totals.debit}, Credits: ${totals.credit}` };
  }

  const entryNumberResult = await q.query<{ entry_number: string }>(
    'SELECT generate_journal_entry_number() AS entry_number'
  );
  const entryNumber = entryNumberResult.rows[0]?.entry_number;
  if (!entryNumber) {
    return { success: false, error: 'Failed to generate journal entry number' };
  }

  const journalEntry = await q.query<{ id: string }>(
    `INSERT INTO journal_entries (
       entry_number, entry_date, description, source_module, source_document_id, status, created_by, company_id
     ) VALUES ($1, $2, $3, $4, $5, 'posted', $6, $7)
     RETURNING id`,
    [entryNumber, header.entry_date, header.description, header.source_module, header.source_document_id,
     createdBy, header.company_id]
  );
  const journalEntryId = journalEntry.rows[0]?.id;
  if (!journalEntryId) {
    return { success: false, error: 'Failed to create journal entry header' };
  }

  let lineNumber = 1;
  for (const line of lines) {
    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description,
         currency, exchange_rate, base_debit, base_credit
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [journalEntryId, lineNumber, line.account_id, line.debit, line.credit, line.description,
       line.currency, line.exchange_rate, line.debit * line.exchange_rate, line.credit * line.exchange_rate]
    );
    lineNumber += 1;
  }

  return { success: true, journalEntryId };
}

export async function createBillJournalEntryWithDb(
  q: QueryExecutor,
  bill: {
    id: string;
    bill_number: string;
    bill_date: string;
    total: number;
    company_id: string;
    currency?: string;
  },
  billLines: Array<{ account_code: string; amount: number; description: string }>,
  createdBy: string
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const apAccountId = await getAccountIdByCode(q, '2000', bill.company_id);
    if (!apAccountId) {
      return { success: false, error: 'Accounts Payable account not found' };
    }

    const debitLines: Array<{ account_id: string; debit: number; credit: number; description: string }> = [];

    for (const line of billLines) {
      const accountId = await getAccountIdByCode(q, line.account_code, bill.company_id);
      if (!accountId) {
        return { success: false, error: `Account ${line.account_code} not found` };
      }

      debitLines.push({
        account_id: accountId,
        debit: line.amount,
        credit: 0,
        description: line.description,
      });
    }

    const totalDebits = debitLines.reduce((sum, line) => sum + line.debit, 0);
    if (Math.abs(totalDebits - bill.total) > 0.01) {
      return {
        success: false,
        error: `Journal entry not balanced. Debits: ${totalDebits}, Credits: ${bill.total}`,
      };
    }

    const currency = bill.currency || 'USD';
    const exchangeRate = await getExchangeRateToBase(q, currency, bill.company_id);

    const entryNumberResult = await q.query<{ entry_number: string }>(
      'SELECT generate_journal_entry_number() AS entry_number'
    );
    const entryNumber = entryNumberResult.rows[0]?.entry_number;
    if (!entryNumber) {
      return { success: false, error: 'Failed to generate journal entry number' };
    }

    const journalEntry = await q.query<{ id: string }>(
      `INSERT INTO journal_entries (
         entry_number, entry_date, description, source_module, source_document_id, status, created_by, company_id
       ) VALUES ($1, $2, $3, 'bill', $4, 'posted', $5, $6)
       RETURNING id`,
      [entryNumber, bill.bill_date, `Bill ${bill.bill_number}`, bill.id, createdBy, bill.company_id]
    );

    const journalEntryId = journalEntry.rows[0]?.id;
    if (!journalEntryId) {
      return { success: false, error: 'Failed to create journal entry header' };
    }

    let lineNumber = 1;
    for (const line of debitLines) {
      await q.query(
        `INSERT INTO journal_lines (
           journal_entry_id, line_number, account_id, debit, credit, description,
           currency, exchange_rate, base_debit, base_credit
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [journalEntryId, lineNumber, line.account_id, line.debit, line.credit, line.description,
         currency, exchangeRate, line.debit * exchangeRate, line.credit * exchangeRate]
      );
      lineNumber += 1;
    }

    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description,
         currency, exchange_rate, base_debit, base_credit
       ) VALUES ($1, $2, $3, 0, $4, $5, $6, $7, 0, $8)`,
      [journalEntryId, lineNumber, apAccountId, bill.total, `AP - Bill ${bill.bill_number}`,
       currency, exchangeRate, bill.total * exchangeRate]
    );

    return { success: true, journalEntryId };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create bill journal entry' };
  }
}

// Sales invoice entry: receivable, revenue net of tax, VAT payable, and the cost of goods
// sold for any stock the invoice already took out (its 'sale' inventory movements).
export async function createInvoiceJournalEntryWithDb(
  q: QueryExecutor,
  invoice: {
    id: string;
    invoice_number: string;
    invoice_date: string;
    total: number;
    tax_amount?: number | null;
    company_id: string;
    currency?: string;
  },
  createdBy: string
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const arAccountId = await getAccountIdByCode(q, '1100', invoice.company_id);
    const revenueAccountId = await getAccountIdByCode(q, '4000', invoice.company_id);
    const vatAccountId = await getAccountIdByCode(q, '2200', invoice.company_id);

    if (!arAccountId || !revenueAccountId) {
      return { success: false, error: 'Required accounts not found for invoice journal entry' };
    }

    const currency = invoice.currency || 'USD';
    const { baseCurrency, exchangeRate } = await getBaseCurrencyAndRate(q, currency, invoice.company_id);
    const cogs = await getCogsGroupsForInvoiceWithDb(q, invoice.id, invoice.company_id);
    if (!cogs.success) {
      return { success: false, error: cogs.error };
    }

    const lines = buildInvoiceJournalLines({
      invoiceNumber: invoice.invoice_number,
      total: Number(invoice.total),
      taxAmount: Number(invoice.tax_amount || 0),
      currency,
      exchangeRate,
      baseCurrency,
      accounts: { receivable: arAccountId, revenue: revenueAccountId, vat: vatAccountId },
      cogs: cogs.groups,
    });

    return await insertJournalEntryWithDb(
      q,
      {
        entry_date: invoice.invoice_date,
        description: `Invoice ${invoice.invoice_number}`,
        source_module: 'invoice',
        source_document_id: invoice.id,
        company_id: invoice.company_id,
      },
      lines,
      createdBy
    );
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create invoice journal entry' };
  }
}

// Sums the cost of stock an invoice took out, grouped by the product's COGS and inventory
// accounts (falling back to 5000 Cost of Goods Sold and 1200 Inventory).
async function getCogsGroupsForInvoiceWithDb(
  q: QueryExecutor,
  invoiceId: string,
  companyId: string
): Promise<{ success: boolean; groups: CogsGroup[]; error?: string }> {
  const rows = await q.query<{ cogs_account_id: string | null; inventory_account_id: string | null; cost: string }>(
    `SELECT p.cogs_account_id, p.inventory_account_id, SUM(COALESCE(m.total_cost, 0)) AS cost
     FROM inventory_movements m
     JOIN products p ON p.id = m.product_id
     WHERE m.reference_type = 'invoice' AND m.reference_id = $1 AND m.movement_type = 'sale'
     GROUP BY p.cogs_account_id, p.inventory_account_id`,
    [invoiceId]
  );
  if (!rows.rowCount) {
    return { success: true, groups: [] };
  }

  const defaultCogs = await getAccountIdByCode(q, '5000', companyId);
  const defaultInventory = await getAccountIdByCode(q, '1200', companyId);
  const groups: CogsGroup[] = [];

  for (const row of rows.rows) {
    const cost = Math.abs(Number(row.cost || 0));
    if (cost <= 0) continue;
    const cogsAccountId = row.cogs_account_id || defaultCogs;
    const inventoryAccountId = row.inventory_account_id || defaultInventory;
    if (!cogsAccountId || !inventoryAccountId) {
      return { success: false, groups: [], error: 'Cost of Goods Sold (5000) or Inventory (1200) account not found' };
    }
    groups.push({ cogs_account_id: cogsAccountId, inventory_account_id: inventoryAccountId, cost });
  }

  return { success: true, groups };
}

export async function createReceiptJournalEntryWithDb(
  q: QueryExecutor,
  receipt: {
    id: string;
    receipt_number: string;
    receipt_date: string;
    total: number;
    payment_method: string;
    company_id: string;
    currency?: string;
  },
  createdBy: string
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const arAccountId = await getAccountIdByCode(q, '1100', receipt.company_id);
    // Fall back to Cash on Hand if a company has no account for the method (e.g. 1040 Mobile Money)
    const cashAccountId =
      (await getAccountIdByCode(q, depositAccountCodeForMethod(receipt.payment_method), receipt.company_id)) ||
      (await getAccountIdByCode(q, '1000', receipt.company_id));

    if (!arAccountId || !cashAccountId) {
      return { success: false, error: 'Required accounts not found for receipt journal entry' };
    }

    const currency = receipt.currency || 'USD';
    const exchangeRate = await getExchangeRateToBase(q, currency, receipt.company_id);
    const baseTotal = receipt.total * exchangeRate;

    const entryNumberResult = await q.query<{ entry_number: string }>(
      'SELECT generate_journal_entry_number() AS entry_number'
    );
    const entryNumber = entryNumberResult.rows[0]?.entry_number;
    if (!entryNumber) {
      return { success: false, error: 'Failed to generate journal entry number' };
    }

    const journalEntry = await q.query<{ id: string }>(
      `INSERT INTO journal_entries (
         entry_number, entry_date, description, source_module, source_document_id, status, created_by, company_id
       ) VALUES ($1, $2, $3, 'receipt', $4, 'posted', $5, $6)
       RETURNING id`,
      [entryNumber, receipt.receipt_date, `Receipt ${receipt.receipt_number}`, receipt.id, createdBy, receipt.company_id]
    );

    const journalEntryId = journalEntry.rows[0]?.id;
    if (!journalEntryId) {
      return { success: false, error: 'Failed to create journal entry header' };
    }

    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description,
         currency, exchange_rate, base_debit, base_credit
       ) VALUES ($1, 1, $2, $3, 0, $4, $5, $6, $7, 0)`,
      [journalEntryId, cashAccountId, receipt.total, `Cash received - Receipt ${receipt.receipt_number}`,
       currency, exchangeRate, baseTotal]
    );

    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description,
         currency, exchange_rate, base_debit, base_credit
       ) VALUES ($1, 2, $2, 0, $3, $4, $5, $6, 0, $7)`,
      [journalEntryId, arAccountId, receipt.total, `AR payment - Receipt ${receipt.receipt_number}`,
       currency, exchangeRate, baseTotal]
    );

    return { success: true, journalEntryId };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create receipt journal entry' };
  }
}

export async function createExpenseJournalEntryWithDb(
  q: QueryExecutor,
  expense: {
    id: string;
    expense_number: string;
    expense_date: string;
    amount: number;
    account_code: string;
    description: string;
    bank_account_id?: string | null;
    company_id: string;
    currency?: string;
  },
  createdBy: string
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const expenseAccountId = await getAccountIdByCode(q, expense.account_code, expense.company_id);

    let cashAccountId: string | null = null;

    if (expense.bank_account_id) {
      const bankAccount = await q.query<{ gl_account_id: string | null }>(
        `SELECT gl_account_id
         FROM bank_accounts
         WHERE id = $1
         LIMIT 1`,
        [expense.bank_account_id]
      );

      cashAccountId = bankAccount.rows[0]?.gl_account_id ?? null;
    }

    if (!cashAccountId) {
      cashAccountId = await getAccountIdByCode(q, '1000', expense.company_id);
    }

    if (!expenseAccountId || !cashAccountId) {
      return { success: false, error: 'Required accounts not found for expense journal entry' };
    }

    const currency = expense.currency || 'USD';
    const exchangeRate = await getExchangeRateToBase(q, currency, expense.company_id);
    const baseAmount = expense.amount * exchangeRate;

    const entryNumberResult = await q.query<{ entry_number: string }>(
      'SELECT generate_journal_entry_number() AS entry_number'
    );
    const entryNumber = entryNumberResult.rows[0]?.entry_number;
    if (!entryNumber) {
      return { success: false, error: 'Failed to generate journal entry number' };
    }

    const journalEntry = await q.query<{ id: string }>(
      `INSERT INTO journal_entries (
         entry_number, entry_date, description, source_module, source_document_id, status, created_by, company_id
       ) VALUES ($1, $2, $3, 'expense', $4, 'posted', $5, $6)
       RETURNING id`,
      [entryNumber, expense.expense_date, `Expense: ${expense.description}`, expense.id, createdBy, expense.company_id]
    );

    const journalEntryId = journalEntry.rows[0]?.id;
    if (!journalEntryId) {
      return { success: false, error: 'Failed to create journal entry header' };
    }

    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description,
         currency, exchange_rate, base_debit, base_credit
       ) VALUES ($1, 1, $2, $3, 0, $4, $5, $6, $7, 0)`,
      [journalEntryId, expenseAccountId, expense.amount, expense.description,
       currency, exchangeRate, baseAmount]
    );

    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description,
         currency, exchange_rate, base_debit, base_credit
       ) VALUES ($1, 2, $2, 0, $3, $4, $5, $6, 0, $7)`,
      [journalEntryId, cashAccountId, expense.amount, `Payment - ${expense.description}`,
       currency, exchangeRate, baseAmount]
    );

    return { success: true, journalEntryId };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create expense journal entry' };
  }
}

// Takes sold stock out at FIFO cost (see takeStockOutWithDb) and records the cost on the
// 'sale' movement so the invoice journal entry can post cost of goods sold. With allowNegative
// (the POS till), a sale is not refused when recorded stock is too low.
export async function reduceInventoryForInvoiceWithDb(
  q: QueryExecutor,
  invoiceId: string,
  lines: Array<{
    product_id?: string | null;
    quantity: number;
    description: string;
  }>,
  userId: string,
  options: { allowNegative?: boolean } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const line of lines) {
      if (!line.product_id || !(Number(line.quantity) > 0)) continue;
      await takeStockOutWithDb(q, {
        productId: line.product_id,
        quantity: Number(line.quantity),
        movementType: 'sale',
        referenceType: 'invoice',
        referenceId: invoiceId,
        notes: line.description,
        userId,
        allowNegative: options.allowNegative,
      });
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to reduce inventory for invoice' };
  }
}

export async function reserveInventoryForQuotationWithDb(
  q: QueryExecutor,
  documentId: string,
  lines: Array<{
    product_id?: string | null;
    quantity: number;
  }>,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const line of lines) {
      if (!line.product_id) {
        continue;
      }

      const productResult = await q.query<{
        track_inventory: boolean;
        quantity_on_hand: number;
        quantity_reserved: number | null;
        name: string;
      }>(
        `SELECT track_inventory, quantity_on_hand, quantity_reserved, name
         FROM products
         WHERE id = $1
         LIMIT 1`,
        [line.product_id]
      );

      const product = productResult.rows[0];
      if (!product?.track_inventory) {
        continue;
      }

      const available = Number(product.quantity_on_hand || 0) - Number(product.quantity_reserved || 0);
      if (available < Number(line.quantity || 0)) {
        return {
          success: false,
          error: `Insufficient inventory for ${product.name}. Available: ${available}, Required: ${line.quantity}`,
        };
      }

      await q.query(
        'UPDATE products SET quantity_reserved = $2, updated_at = NOW() WHERE id = $1',
        [line.product_id, Number(product.quantity_reserved || 0) + Number(line.quantity || 0)]
      );

      await q.query(
        `INSERT INTO inventory_movements (
           product_id, movement_type, quantity, reference_type, reference_id, created_by
         ) VALUES ($1, 'reserved', $2, 'quotation', $3, $4)`,
        [line.product_id, -Number(line.quantity || 0), documentId, userId]
      );
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to reserve inventory' };
  }
}

export async function releaseReservedInventoryWithDb(
  q: QueryExecutor,
  lines: Array<{
    product_id?: string | null;
    quantity: number;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const line of lines) {
      if (!line.product_id) {
        continue;
      }

      const productResult = await q.query<{ quantity_reserved: number | null }>(
        'SELECT quantity_reserved FROM products WHERE id = $1 LIMIT 1',
        [line.product_id]
      );

      const reserved = Number(productResult.rows[0]?.quantity_reserved || 0);
      await q.query(
        'UPDATE products SET quantity_reserved = $2, updated_at = NOW() WHERE id = $1',
        [line.product_id, Math.max(0, reserved - Number(line.quantity || 0))]
      );
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to release reserved inventory' };
  }
}

// Puts an invoice's stock back (void). The returned quantity becomes a new lot at the cost it
// left at, so the reversal of the invoice's cost-of-goods lines matches the stock value restored.
export async function restoreInventoryForInvoiceWithDb(
  q: QueryExecutor,
  invoiceId: string,
  lines: Array<{
    product_id?: string | null;
    quantity: number;
  }>,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const line of lines) {
      if (!line.product_id || !(Number(line.quantity) > 0)) continue;
      const product = await q.query<{ cost_price: string | null }>('SELECT cost_price FROM products WHERE id = $1', [line.product_id]);
      const unitCost = (await getInvoiceSaleUnitCostWithDb(q, invoiceId, line.product_id)) ?? Number(product.rows[0]?.cost_price || 0);
      await putStockInWithDb(q, {
        productId: line.product_id,
        quantity: Number(line.quantity),
        unitCost,
        movementType: 'return',
        referenceType: 'invoice_void',
        referenceId: invoiceId,
        lotNumber: `RETURN-${invoiceId.slice(0, 8)}`,
        userId,
      });
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to restore inventory for invoice' };
  }
}

// Ledger account code for each bill line. Stock enters only through receiving (which credits
// 2150 Goods Received Not Invoiced), so a bill line for a stock-tracked product debits 2150
// instead of an expense and does not change stock. Other lines keep their chosen account.
export async function billLineAccountCodesWithDb(
  q: QueryExecutor,
  lines: Array<{ product_id?: string | null; expense_account_id?: string | null }>,
  accountMap: Record<string, string>
): Promise<string[]> {
  const productIds = [...new Set(lines.map((l) => l.product_id).filter(Boolean))] as string[];
  const tracked = new Set<string>();
  if (productIds.length) {
    const result = await q.query<{ id: string }>(
      'SELECT id FROM products WHERE id = ANY($1::uuid[]) AND track_inventory = true',
      [productIds]
    );
    result.rows.forEach((row) => tracked.add(row.id));
  }
  return lines.map((line) => {
    if (line.product_id && tracked.has(line.product_id)) return '2150';
    return Object.keys(accountMap).find((key) => accountMap[key] === line.expense_account_id) || '5000';
  });
}

// Unit cost at which a product left on an invoice (from its 'sale' movements), or null.
export async function getInvoiceSaleUnitCostWithDb(
  q: QueryExecutor,
  invoiceId: string,
  productId: string
): Promise<number | null> {
  const sold = await q.query<{ quantity: string; cost: string }>(
    `SELECT COALESCE(SUM(-quantity), 0) AS quantity, COALESCE(SUM(total_cost), 0) AS cost
     FROM inventory_movements
     WHERE reference_type = 'invoice' AND reference_id = $1 AND product_id = $2 AND movement_type = 'sale'`,
    [invoiceId, productId]
  );
  const quantity = Number(sold.rows[0]?.quantity || 0);
  return quantity > 0 ? Number(sold.rows[0].cost) / quantity : null;
}

// Puts returned goods back on the shelf at the given cost, so FIFO sells them again at what
// they cost.
export async function returnStockWithDb(
  q: QueryExecutor,
  input: {
    productId: string;
    quantity: number;
    unitCost: number;
    referenceType: string;
    referenceId: string;
    lotNumber: string;
    notes?: string;
    userId: string;
  }
): Promise<void> {
  await putStockInWithDb(q, { ...input, movementType: 'return' });
}
