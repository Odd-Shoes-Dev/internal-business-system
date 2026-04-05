import type { DbProvider } from '@/lib/provider/types';

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

export async function getAccountIdByCode(q: QueryExecutor, code: string): Promise<string | null> {
  const result = await q.query<{ id: string }>('SELECT id FROM accounts WHERE code = $1 LIMIT 1', [code]);
  return result.rows[0]?.id ?? null;
}

export async function createBillJournalEntryWithDb(
  q: QueryExecutor,
  bill: {
    id: string;
    bill_number: string;
    bill_date: string;
    total: number;
  },
  billLines: Array<{ account_code: string; amount: number; description: string }>,
  createdBy: string
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const apAccountId = await getAccountIdByCode(q, '2000');
    if (!apAccountId) {
      return { success: false, error: 'Accounts Payable account not found' };
    }

    const debitLines: Array<{ account_id: string; debit: number; credit: number; description: string }> = [];

    for (const line of billLines) {
      const accountId = await getAccountIdByCode(q, line.account_code);
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

    const entryNumberResult = await q.query<{ entry_number: string }>(
      'SELECT generate_journal_entry_number() AS entry_number'
    );
    const entryNumber = entryNumberResult.rows[0]?.entry_number;
    if (!entryNumber) {
      return { success: false, error: 'Failed to generate journal entry number' };
    }

    const journalEntry = await q.query<{ id: string }>(
      `INSERT INTO journal_entries (
         entry_number, entry_date, description, source_module, source_document_id, status, created_by
       ) VALUES ($1, $2, $3, 'bill', $4, 'posted', $5)
       RETURNING id`,
      [entryNumber, bill.bill_date, `Bill ${bill.bill_number}`, bill.id, createdBy]
    );

    const journalEntryId = journalEntry.rows[0]?.id;
    if (!journalEntryId) {
      return { success: false, error: 'Failed to create journal entry header' };
    }

    let lineNumber = 1;
    for (const line of debitLines) {
      await q.query(
        `INSERT INTO journal_lines (
           journal_entry_id, line_number, account_id, debit, credit, description
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [journalEntryId, lineNumber, line.account_id, line.debit, line.credit, line.description]
      );
      lineNumber += 1;
    }

    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description
       ) VALUES ($1, $2, $3, 0, $4, $5)`,
      [journalEntryId, lineNumber, apAccountId, bill.total, `AP - Bill ${bill.bill_number}`]
    );

    return { success: true, journalEntryId };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create bill journal entry' };
  }
}

export async function createInvoiceJournalEntryWithDb(
  q: QueryExecutor,
  invoice: {
    id: string;
    invoice_number: string;
    invoice_date: string;
    total: number;
  },
  createdBy: string
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const arAccountId = await getAccountIdByCode(q, '1200');
    const revenueAccountId = await getAccountIdByCode(q, '4000');

    if (!arAccountId || !revenueAccountId) {
      return { success: false, error: 'Required accounts not found for invoice journal entry' };
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
         entry_number, entry_date, description, source_module, source_document_id, status, created_by
       ) VALUES ($1, $2, $3, 'invoice', $4, 'posted', $5)
       RETURNING id`,
      [entryNumber, invoice.invoice_date, `Invoice ${invoice.invoice_number}`, invoice.id, createdBy]
    );

    const journalEntryId = journalEntry.rows[0]?.id;
    if (!journalEntryId) {
      return { success: false, error: 'Failed to create journal entry header' };
    }

    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description
       ) VALUES ($1, 1, $2, $3, 0, $4)`,
      [journalEntryId, arAccountId, invoice.total, `AR - Invoice ${invoice.invoice_number}`]
    );

    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description
       ) VALUES ($1, 2, $2, 0, $3, $4)`,
      [journalEntryId, revenueAccountId, invoice.total, `Revenue - Invoice ${invoice.invoice_number}`]
    );

    return { success: true, journalEntryId };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create invoice journal entry' };
  }
}

export async function createReceiptJournalEntryWithDb(
  q: QueryExecutor,
  receipt: {
    id: string;
    receipt_number: string;
    receipt_date: string;
    total: number;
    payment_method: string;
  },
  createdBy: string
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const arAccountId = await getAccountIdByCode(q, '1200');
    let cashAccountCode = '1000';
    if (receipt.payment_method === 'bank_transfer' || receipt.payment_method === 'check') {
      cashAccountCode = '1010';
    }
    const cashAccountId = await getAccountIdByCode(q, cashAccountCode);

    if (!arAccountId || !cashAccountId) {
      return { success: false, error: 'Required accounts not found for receipt journal entry' };
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
         entry_number, entry_date, description, source_module, source_document_id, status, created_by
       ) VALUES ($1, $2, $3, 'receipt', $4, 'posted', $5)
       RETURNING id`,
      [entryNumber, receipt.receipt_date, `Receipt ${receipt.receipt_number}`, receipt.id, createdBy]
    );

    const journalEntryId = journalEntry.rows[0]?.id;
    if (!journalEntryId) {
      return { success: false, error: 'Failed to create journal entry header' };
    }

    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description
       ) VALUES ($1, 1, $2, $3, 0, $4)`,
      [journalEntryId, cashAccountId, receipt.total, `Cash received - Receipt ${receipt.receipt_number}`]
    );

    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description
       ) VALUES ($1, 2, $2, 0, $3, $4)`,
      [journalEntryId, arAccountId, receipt.total, `AR payment - Receipt ${receipt.receipt_number}`]
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
  },
  createdBy: string
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const expenseAccountId = await getAccountIdByCode(q, expense.account_code);

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
      cashAccountId = await getAccountIdByCode(q, '1000');
    }

    if (!expenseAccountId || !cashAccountId) {
      return { success: false, error: 'Required accounts not found for expense journal entry' };
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
         entry_number, entry_date, description, source_module, source_document_id, status, created_by
       ) VALUES ($1, $2, $3, 'expense', $4, 'posted', $5)
       RETURNING id`,
      [entryNumber, expense.expense_date, `Expense: ${expense.description}`, expense.id, createdBy]
    );

    const journalEntryId = journalEntry.rows[0]?.id;
    if (!journalEntryId) {
      return { success: false, error: 'Failed to create journal entry header' };
    }

    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description
       ) VALUES ($1, 1, $2, $3, 0, $4)`,
      [journalEntryId, expenseAccountId, expense.amount, expense.description]
    );

    await q.query(
      `INSERT INTO journal_lines (
         journal_entry_id, line_number, account_id, debit, credit, description
       ) VALUES ($1, 2, $2, 0, $3, $4)`,
      [journalEntryId, cashAccountId, expense.amount, `Payment - ${expense.description}`]
    );

    return { success: true, journalEntryId };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create expense journal entry' };
  }
}

export async function reduceInventoryForInvoiceWithDb(
  q: QueryExecutor,
  invoiceId: string,
  lines: Array<{
    product_id?: string | null;
    quantity: number;
    description: string;
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
        'UPDATE products SET quantity_on_hand = $2, updated_at = NOW() WHERE id = $1',
        [line.product_id, Number(product.quantity_on_hand || 0) - Number(line.quantity || 0)]
      );

      await q.query(
        `INSERT INTO inventory_movements (
           product_id, movement_type, quantity, reference_type, reference_id, notes, created_by
         ) VALUES ($1, 'sale', $2, 'invoice', $3, $4, $5)`,
        [line.product_id, -Number(line.quantity || 0), invoiceId, line.description, userId]
      );
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
      if (!line.product_id) {
        continue;
      }

      const productResult = await q.query<{
        track_inventory: boolean;
        quantity_on_hand: number;
      }>(
        'SELECT track_inventory, quantity_on_hand FROM products WHERE id = $1 LIMIT 1',
        [line.product_id]
      );

      const product = productResult.rows[0];
      if (!product?.track_inventory) {
        continue;
      }

      await q.query(
        'UPDATE products SET quantity_on_hand = $2, updated_at = NOW() WHERE id = $1',
        [line.product_id, Number(product.quantity_on_hand || 0) + Number(line.quantity || 0)]
      );

      await q.query(
        `INSERT INTO inventory_movements (
           product_id, movement_type, quantity, reference_type, reference_id, created_by
         ) VALUES ($1, 'return', $2, 'invoice_void', $3, $4)`,
        [line.product_id, Number(line.quantity || 0), invoiceId, userId]
      );
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to restore inventory for invoice' };
  }
}

export async function increaseInventoryForBillWithDb(
  q: QueryExecutor,
  billId: string,
  billDate: string,
  lines: Array<{
    product_id?: string | null;
    quantity: number;
    unit_cost: number;
    line_total: number;
    description: string;
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
        cost_price: number | null;
      }>(
        'SELECT track_inventory, quantity_on_hand, cost_price FROM products WHERE id = $1 LIMIT 1',
        [line.product_id]
      );

      const product = productResult.rows[0];
      if (!product?.track_inventory) {
        continue;
      }

      const newQty = Number(product.quantity_on_hand || 0) + Number(line.quantity || 0);
      const previousCost = Number(product.cost_price || 0);
      const newCost =
        newQty > 0
          ? (Number(product.quantity_on_hand || 0) * previousCost + Number(line.quantity || 0) * Number(line.unit_cost || 0)) / newQty
          : Number(line.unit_cost || 0);

      await q.query(
        'UPDATE products SET quantity_on_hand = $2, cost_price = $3, updated_at = NOW() WHERE id = $1',
        [line.product_id, newQty, newCost]
      );

      await q.query(
        `INSERT INTO inventory_movements (
           product_id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, notes, created_by
         ) VALUES ($1, 'purchase', $2, $3, $4, 'bill', $5, $6, $7)`,
        [line.product_id, line.quantity, line.unit_cost, line.line_total, billId, line.description, userId]
      );

      await q.query(
        `INSERT INTO inventory_lots (
           product_id, quantity_received, quantity_remaining, unit_cost, received_date
         ) VALUES ($1, $2, $3, $4, $5::date)`,
        [line.product_id, line.quantity, line.quantity, line.unit_cost, billDate]
      );
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to increase inventory for bill' };
  }
}
