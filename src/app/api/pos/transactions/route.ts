import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser, requireCompanyAccess } from '@/lib/provider/route-guards';
import {
  createInvoiceJournalEntryWithDb,
  createReceiptJournalEntryWithDb,
  reduceInventoryForInvoiceWithDb,
  validatePeriodLockWithDb,
} from '@/lib/accounting/provider-accounting';

interface CartItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number; // decimal e.g. 0.18
}

interface PaymentLine {
  method: 'cash' | 'card' | 'mobile_money';
  amount: number;
  reference?: string; // mobile money reference
}

// GET /api/pos/transactions — list POS sales for manager view
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const sessionId = searchParams.get('session_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) return companyAccessError;

    const params: any[] = [companyId];
    const where: string[] = [`i.company_id = $1 AND i.document_type = 'pos_sale'`];

    if (sessionId) {
      params.push(sessionId);
      where.push(`i.pos_session_id = $${params.length}`);
    }

    const result = await db.query(
      `SELECT
         i.id, i.invoice_number, i.total, i.subtotal, i.tax_amount, i.currency,
         i.created_at, i.pos_session_id,
         c.name AS customer_name,
         t.name AS terminal_name
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       LEFT JOIN pos_sessions s ON s.id = i.pos_session_id
       LEFT JOIN pos_terminals t ON t.id = s.terminal_id
       WHERE ${where.join(' AND ')}
       ORDER BY i.created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/pos/transactions — record a POS sale
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const {
      company_id,
      session_id,
      items,
      payments,
      customer_id,
      currency = 'UGX',
      notes,
    }: {
      company_id: string;
      session_id: string;
      items: CartItem[];
      payments: PaymentLine[];
      customer_id?: string;
      currency?: string;
      notes?: string;
    } = body;

    if (!company_id) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    if (!session_id) return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    if (!items?.length) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    if (!payments?.length) return NextResponse.json({ error: 'Payment is required' }, { status: 400 });

    const companyAccessError = await requireCompanyAccess(user.id, company_id);
    if (companyAccessError) return companyAccessError;

    // Verify session is open and belongs to company
    const sessionResult = await db.query(
      `SELECT * FROM pos_sessions WHERE id = $1 AND company_id = $2 AND status = 'open' LIMIT 1`,
      [session_id, company_id]
    );
    if (!sessionResult.rows[0]) {
      return NextResponse.json({ error: 'POS session not found or already closed' }, { status: 404 });
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const taxAmount = items.reduce((sum, item) => sum + item.unit_price * item.quantity * (item.tax_rate || 0), 0);
    const total = subtotal + taxAmount;
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    if (totalPaid < total - 0.01) {
      return NextResponse.json({ error: 'Payment amount is less than total' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const periodError = await validatePeriodLockWithDb(db, today, company_id);
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 400 });
    }

    // One transaction: a failure part-way (e.g. a missing account) leaves no half-recorded sale
    const invoice = await db.transaction(async (tx) => {
      const invoiceResult = await tx.query(
        `INSERT INTO invoices (
           company_id, customer_id, invoice_number, document_type,
           invoice_date, due_date, status, currency,
           subtotal, tax_amount, total, amount_paid,
           pos_session_id, notes
         ) VALUES (
           $1, $2, generate_pos_sale_number(), 'pos_sale',
           CURRENT_DATE, CURRENT_DATE, 'paid', $3,
           $4, $5, $6, $6,
           $7, $8
         ) RETURNING *`,
        [
          company_id, customer_id || null,
          currency, subtotal, taxAmount, total,
          session_id, notes || null,
        ]
      );
      const invoice = invoiceResult.rows[0];

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const lineTotal = item.unit_price * item.quantity;
        const lineTax = lineTotal * (item.tax_rate || 0);
        await tx.query(
          `INSERT INTO invoice_lines (invoice_id, product_id, description, line_number, quantity, unit_price, tax_rate, tax_amount, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            invoice.id,
            item.product_id || null,
            item.name,
            idx + 1,
            item.quantity,
            item.unit_price,
            item.tax_rate || 0,
            lineTax,
            lineTotal,
          ]
        );
      }

      // Stock out at FIFO cost. A till sale is not refused when recorded stock is too low:
      // the goods are physically at the counter, so the count is what is wrong.
      const inventoryResult = await reduceInventoryForInvoiceWithDb(
        tx,
        invoice.id,
        items.map((item) => ({ product_id: item.product_id, quantity: item.quantity, description: `POS sale ${invoice.invoice_number}` })),
        user.id,
        { allowNegative: true }
      );
      if (!inventoryResult.success) {
        throw new Error(inventoryResult.error || 'Failed to update inventory');
      }

      // Revenue, VAT and cost of goods sold
      const saleJournal = await createInvoiceJournalEntryWithDb(
        tx,
        {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          total: Number(invoice.total),
          tax_amount: Number(invoice.tax_amount || 0),
          company_id,
          currency,
        },
        user.id
      );
      if (!saleJournal.success) {
        throw new Error(saleJournal.error || 'Failed to post POS sale to the ledger');
      }
      await tx.query('UPDATE invoices SET journal_entry_id = $2 WHERE id = $1', [invoice.id, saleJournal.journalEntryId]);
      invoice.journal_entry_id = saleJournal.journalEntryId;

      // One payment record and ledger entry per payment method; together they clear the receivable.
      // Record only what settles the sale (cash tendered above the total is change, not income).
      let remainingToApply = total;
      for (const payment of payments) {
        const amount = Math.min(payment.amount, remainingToApply);
        if (amount <= 0) continue;
        remainingToApply -= amount;

        const paymentResult = await tx.query(
          `INSERT INTO payments_received (
             company_id, customer_id, payment_number, amount, currency,
             payment_date, payment_method, source, pos_session_id,
             reference_number
           ) VALUES ($1, $2, generate_payment_number(), $3, $4, CURRENT_DATE, $5, 'pos', $6, $7)
           RETURNING id, payment_number, payment_date`,
          [
            company_id,
            customer_id || null,
            amount,
            currency,
            payment.method,
            session_id,
            payment.reference || null,
          ]
        );
        const paymentRow = paymentResult.rows[0];

        await tx.query(
          `INSERT INTO payment_applications (payment_id, invoice_id, amount_applied)
           VALUES ($1, $2, $3)`,
          [paymentRow.id, invoice.id, amount]
        );

        const paymentJournal = await createReceiptJournalEntryWithDb(
          tx,
          {
            id: paymentRow.id,
            receipt_number: paymentRow.payment_number,
            receipt_date: paymentRow.payment_date,
            total: amount,
            payment_method: payment.method,
            company_id,
            currency,
          },
          user.id
        );
        if (!paymentJournal.success) {
          throw new Error(paymentJournal.error || 'Failed to post POS payment to the ledger');
        }
        await tx.query('UPDATE payments_received SET journal_entry_id = $2 WHERE id = $1', [
          paymentRow.id,
          paymentJournal.journalEntryId,
        ]);
      }

      await tx.query(
        `UPDATE pos_sessions SET
           total_sales = total_sales + $2,
           transaction_count = transaction_count + 1,
           updated_at = NOW()
         WHERE id = $1`,
        [session_id, total]
      );

      return invoice;
    });

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
