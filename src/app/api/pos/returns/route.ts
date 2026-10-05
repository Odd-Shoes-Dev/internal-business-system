import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import {
  getAccountIdByCode,
  getBaseCurrencyAndRate,
  getInvoiceSaleUnitCostWithDb,
  insertJournalEntryWithDb,
  returnStockWithDb,
  validatePeriodLockWithDb,
} from '@/lib/accounting/provider-accounting';
import { depositAccountCodeForMethod, type JournalLine } from '@/lib/accounting/inventory-costing';
import { priceReturn, type ReturnRequestLine, type SoldLine } from '@/lib/pos/returns';
import { recalculateCustomerBalanceWithDb, recordLoyaltyWithDb } from '@/lib/pos/loyalty-db';

const REFUND_METHODS = ['cash', 'card', 'mobile_money', 'account'] as const;
type RefundMethod = (typeof REFUND_METHODS)[number];

async function loadSale(db: { query: (t: string, p?: any[]) => Promise<any> }, companyId: string, where: string, value: string) {
  const invoiceResult = await db.query(
    `SELECT i.id, i.invoice_number, i.invoice_date, i.status, i.currency, i.subtotal, i.tax_amount,
            i.discount_amount, i.total, i.amount_paid, i.customer_id, i.company_id, c.name AS customer_name
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id
     WHERE i.company_id = $1 AND i.document_type = 'pos_sale' AND ${where} = $2
     LIMIT 1`,
    [companyId, value]
  );
  const invoice = invoiceResult.rows[0];
  if (!invoice) return null;

  const linesResult = await db.query(
    `SELECT il.id, il.product_id, il.description, il.quantity, il.unit_price, il.line_total, il.tax_amount,
            COALESCE((SELECT SUM(rl.quantity) FROM pos_return_lines rl WHERE rl.invoice_line_id = il.id), 0) AS returned_quantity
     FROM invoice_lines il
     WHERE il.invoice_id = $1
     ORDER BY il.line_number`,
    [invoice.id]
  );

  const refundsResult = await db.query(
    `SELECT COALESCE(SUM(total) FILTER (WHERE refund_method <> 'account'), 0) AS money_refunded,
            COALESCE(SUM(total) FILTER (WHERE refund_method = 'account'), 0) AS account_credited
     FROM pos_returns WHERE invoice_id = $1`,
    [invoice.id]
  );

  const lines: SoldLine[] = linesResult.rows.map((row: any) => ({
    id: row.id,
    product_id: row.product_id,
    description: row.description,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    line_total: Number(row.line_total),
    tax_amount: Number(row.tax_amount),
    returned_quantity: Number(row.returned_quantity),
  }));

  return {
    invoice,
    lines,
    moneyRefunded: Number(refundsResult.rows[0]?.money_refunded || 0),
    accountCredited: Number(refundsResult.rows[0]?.account_credited || 0),
  };
}

// GET /api/pos/returns?company_id=&number=POS-2026-000123 — a sale and what can still be returned
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const number = (searchParams.get('number') || '').trim().toUpperCase();
    if (!companyId || !number) return NextResponse.json({ error: 'company_id and number are required' }, { status: 400 });

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const sale = await loadSale(db, companyId, 'i.invoice_number', number);
    if (!sale) return NextResponse.json({ error: `No POS sale found with receipt ${number}` }, { status: 404 });

    return NextResponse.json({
      data: {
        ...sale.invoice,
        lines: sale.lines,
        refundable_money: Math.max(0, Number(sale.invoice.amount_paid) - sale.moneyRefunded),
        balance_due: Math.max(0, Number(sale.invoice.total) - Number(sale.invoice.amount_paid)),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/pos/returns — refund items from a POS sale
// Body: company_id, invoice_id, session_id?, refund_method, reason?, lines: [{ invoice_line_id, quantity, restock }]
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const { company_id, invoice_id, session_id, reason } = body as {
      company_id: string; invoice_id: string; session_id?: string | null; reason?: string;
    };
    const refundMethod = body.refund_method as RefundMethod;
    const requested = (body.lines || []) as ReturnRequestLine[];

    if (!company_id || !invoice_id) return NextResponse.json({ error: 'company_id and invoice_id are required' }, { status: 400 });
    if (!REFUND_METHODS.includes(refundMethod)) return NextResponse.json({ error: 'Choose how the refund is paid' }, { status: 400 });

    const accessError = await requireCompanyAccess(user.id, company_id);
    if (accessError) return accessError;

    const today = new Date().toISOString().split('T')[0];
    const periodError = await validatePeriodLockWithDb(db, today, company_id);
    if (periodError) return NextResponse.json({ error: periodError }, { status: 400 });

    if (session_id) {
      const sessionResult = await db.query(
        `SELECT id FROM pos_sessions WHERE id = $1 AND company_id = $2 AND status = 'open' LIMIT 1`,
        [session_id, company_id]
      );
      if (!sessionResult.rows[0]) return NextResponse.json({ error: 'POS session not found or already closed' }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      // Lock the sale so two returns of the same items cannot both pass the checks
      await tx.query('SELECT id FROM invoices WHERE id = $1 FOR UPDATE', [invoice_id]);
      const sale = await loadSale(tx, company_id, 'i.id', invoice_id);
      if (!sale) throw new ReturnError('POS sale not found', 404);
      const { invoice } = sale;
      if (invoice.status === 'void') throw new ReturnError('This sale was voided');

      const priced = priceReturn(sale.lines, requested);
      if ('error' in priced) throw new ReturnError(priced.error);

      // Money back only up to what was paid; on-account credit only up to what is still owed
      if (refundMethod === 'account') {
        if (!invoice.customer_id) throw new ReturnError('This sale has no customer account to credit');
        const balanceDue = Number(invoice.total) - Number(invoice.amount_paid);
        if (priced.total > balanceDue + 0.01) {
          throw new ReturnError(`Only ${balanceDue.toFixed(2)} is owed on this sale; refund the rest in cash, card or mobile money`);
        }
      } else {
        const refundable = Number(invoice.amount_paid) - sale.moneyRefunded;
        if (priced.total > refundable + 0.01) {
          throw new ReturnError(`Only ${refundable.toFixed(2)} was paid on this sale; credit the rest to the customer's account`);
        }
      }

      const currency = invoice.currency || 'UGX';
      const returnResult = await tx.query(
        `INSERT INTO pos_returns (
           company_id, invoice_id, session_id, return_number, reason, refund_method,
           subtotal, tax_amount, total, currency, created_by
         ) VALUES ($1, $2, $3, generate_pos_return_number(), $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [company_id, invoice.id, session_id || null, reason || null, refundMethod,
         priced.subtotal, priced.tax, priced.total, currency, user.id]
      );
      const posReturn = returnResult.rows[0];

      // Ledger: reverse revenue and VAT, pay the refund out (or reduce what the customer owes),
      // and for restocked goods move their cost back from COGS to Inventory
      const revenueAccount = await getAccountIdByCode(tx, '4000', company_id);
      const vatAccount = await getAccountIdByCode(tx, '2200', company_id);
      const creditAccount = refundMethod === 'account'
        ? await getAccountIdByCode(tx, '1100', company_id)
        : (await getAccountIdByCode(tx, depositAccountCodeForMethod(refundMethod), company_id)) ||
          (await getAccountIdByCode(tx, '1000', company_id));
      if (!revenueAccount || !creditAccount) throw new ReturnError('Required ledger accounts are missing', 500);

      const { baseCurrency, exchangeRate } = await getBaseCurrencyAndRate(tx, currency, company_id);
      const tax = vatAccount ? priced.tax : 0;
      const journalLines: JournalLine[] = [
        { account_id: revenueAccount, debit: Math.round((priced.total - tax) * 100) / 100, credit: 0, description: `Return ${posReturn.return_number} - revenue`, currency, exchange_rate: exchangeRate },
      ];
      if (tax > 0 && vatAccount) {
        journalLines.push({ account_id: vatAccount, debit: tax, credit: 0, description: `Return ${posReturn.return_number} - VAT`, currency, exchange_rate: exchangeRate });
      }
      journalLines.push({
        account_id: creditAccount, debit: 0, credit: priced.total,
        description: `Return ${posReturn.return_number} - ${refundMethod === 'account' ? 'credited to customer' : 'refund paid'}`,
        currency, exchange_rate: exchangeRate,
      });

      const defaultCogs = await getAccountIdByCode(tx, '5000', company_id);
      const defaultInventory = await getAccountIdByCode(tx, '1200', company_id);

      for (const line of priced.lines) {
        let unitCost: number | null = null;
        if (line.restock && line.product_id) {
          const productResult = await tx.query<{ track_inventory: boolean; cost_price: string | null; cogs_account_id: string | null; inventory_account_id: string | null }>(
            'SELECT track_inventory, cost_price, cogs_account_id, inventory_account_id FROM products WHERE id = $1 FOR UPDATE',
            [line.product_id]
          );
          const product = productResult.rows[0];
          if (product?.track_inventory) {
            unitCost = (await getInvoiceSaleUnitCostWithDb(tx, invoice.id, line.product_id)) ?? Number(product.cost_price || 0);
            await returnStockWithDb(tx, {
              productId: line.product_id,
              quantity: line.quantity,
              unitCost,
              referenceType: 'pos_return',
              referenceId: posReturn.id,
              lotNumber: posReturn.return_number,
              notes: `Return of ${invoice.invoice_number}`,
              userId: user.id,
            });

            const cost = Math.round(unitCost * line.quantity * 100) / 100;
            const inventoryAccount = product.inventory_account_id || defaultInventory;
            const cogsAccount = product.cogs_account_id || defaultCogs;
            if (cost > 0 && inventoryAccount && cogsAccount) {
              journalLines.push(
                { account_id: inventoryAccount, debit: cost, credit: 0, description: `Return ${posReturn.return_number} - stock back`, currency: baseCurrency, exchange_rate: 1 },
                { account_id: cogsAccount, debit: 0, credit: cost, description: `Return ${posReturn.return_number} - COGS reversed`, currency: baseCurrency, exchange_rate: 1 }
              );
            }
          }
        }

        await tx.query(
          `INSERT INTO pos_return_lines (
             return_id, invoice_line_id, product_id, description, quantity, unit_price, tax_amount, line_total, restock, unit_cost
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [posReturn.id, line.invoice_line_id, line.product_id, line.description, line.quantity, line.unit_price,
           line.tax, line.net, line.restock, unitCost]
        );
      }

      const journal = await insertJournalEntryWithDb(
        tx,
        {
          entry_date: today,
          description: `POS return ${posReturn.return_number} (${invoice.invoice_number})`,
          source_module: 'pos_return',
          source_document_id: posReturn.id,
          company_id,
        },
        journalLines,
        user.id
      );
      if (!journal.success) throw new ReturnError(journal.error || 'Failed to post the return', 500);
      await tx.query('UPDATE pos_returns SET journal_entry_id = $2 WHERE id = $1', [posReturn.id, journal.journalEntryId]);

      // On-account credit settles part of what the customer owes on the sale
      if (refundMethod === 'account') {
        const credit = await tx.query(
          `INSERT INTO payments_received (
             company_id, customer_id, payment_number, amount, currency, payment_date, payment_method,
             source, pos_session_id, reference_number, notes
           ) VALUES ($1, $2, generate_payment_number(), $3, $4, CURRENT_DATE, 'other', 'pos_return', $5, $6, $7)
           RETURNING id`,
          [company_id, invoice.customer_id, priced.total, currency, session_id || null, posReturn.return_number,
           `Credit for return ${posReturn.return_number}; posted by the return's journal entry`]
        );
        await tx.query('INSERT INTO payment_applications (payment_id, invoice_id, amount_applied) VALUES ($1, $2, $3)', [
          credit.rows[0].id, invoice.id, priced.total,
        ]);
        await tx.query(
          `UPDATE invoices SET
             amount_paid = amount_paid + $2,
             status = CASE WHEN amount_paid + $2 >= total - 0.01 THEN 'paid'::invoice_status ELSE 'partial'::invoice_status END
           WHERE id = $1`,
          [invoice.id, priced.total]
        );
      }

      // Take back loyalty points earned on the returned share of the sale
      if (invoice.customer_id && Number(invoice.total) > 0) {
        const earned = await tx.query<{ points: string }>(
          `SELECT COALESCE(SUM(points), 0) AS points FROM loyalty_transactions WHERE invoice_id = $1 AND type = 'earn'`,
          [invoice.id]
        );
        const reverse = Math.floor(Number(earned.rows[0]?.points || 0) * (priced.total / Number(invoice.total)));
        if (reverse > 0) {
          await recordLoyaltyWithDb(tx, {
            companyId: company_id, customerId: invoice.customer_id, points: -reverse, type: 'reverse',
            invoiceId: invoice.id, returnId: posReturn.id, userId: user.id,
          });
        }
        await recalculateCustomerBalanceWithDb(tx, invoice.customer_id);
      }

      if (session_id) {
        await tx.query(
          'UPDATE pos_sessions SET total_refunds = total_refunds + $2, updated_at = NOW() WHERE id = $1',
          [session_id, priced.total]
        );
      }

      return { ...posReturn, journal_entry_id: journal.journalEntryId, lines: priced.lines, invoice_number: invoice.invoice_number };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    if (error instanceof ReturnError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

class ReturnError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
