import { NextRequest, NextResponse, after } from 'next/server';
import { requireSessionUser, requireCompanyAccess } from '@/lib/provider/route-guards';
import {
  createInvoiceJournalEntryWithDb,
  createReceiptJournalEntryWithDb,
  reduceInventoryForInvoiceWithDb,
  validatePeriodLockWithDb,
} from '@/lib/accounting/provider-accounting';
import { pricePosCart, type PosLineInput } from '@/lib/pos/pricing';
import { loyaltyPointsEarned, loyaltyRedemptionValue, maxRedeemablePoints } from '@/lib/pos/settings';
import { getPosSettingsWithDb } from '@/lib/pos/settings-db';
import { recalculateCustomerBalanceWithDb, recordLoyaltyWithDb } from '@/lib/pos/loyalty-db';
import { sendOrderConfirmationWithDb } from '@/lib/whatsapp';
import { getDbProvider } from '@/lib/provider';

interface PaymentLine {
  method: 'cash' | 'card' | 'mobile_money';
  amount: number;
  reference?: string; // mobile money reference
}

const PAYMENT_METHODS = ['cash', 'card', 'mobile_money'];

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
         i.id, i.invoice_number, i.total, i.subtotal, i.tax_amount, i.discount_amount, i.amount_paid, i.status, i.currency,
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
//
// Body: items (with optional per-line discount_amount), cart_discount, payments, and optionally
// customer_id, pay_later (leave the unpaid part on the customer's account) and
// loyalty_points_redeemed (taken off the cart as a discount).
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const {
      company_id,
      session_id,
      items,
      payments = [],
      customer_id,
      cart_discount = 0,
      pay_later = false,
      loyalty_points_redeemed = 0,
      currency = 'UGX',
      notes,
    }: {
      company_id: string;
      session_id: string;
      items: PosLineInput[];
      payments?: PaymentLine[];
      customer_id?: string | null;
      cart_discount?: number;
      pay_later?: boolean;
      loyalty_points_redeemed?: number;
      currency?: string;
      notes?: string;
    } = body;

    if (!company_id) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    if (!session_id) return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    if (!items?.length) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    if (items.some((i) => !(Number(i.quantity) > 0) || Number(i.unit_price) < 0)) {
      return NextResponse.json({ error: 'Each item needs a positive quantity and a price' }, { status: 400 });
    }
    if (payments.some((p) => !PAYMENT_METHODS.includes(p.method) || !(Number(p.amount) >= 0))) {
      return NextResponse.json({ error: 'Invalid payment' }, { status: 400 });
    }

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

    let customer: {
      id: string; name: string; whatsapp_number: string | null; phone: string | null;
      loyalty_points: string; credit_limit: string | null; payment_terms: number | null;
    } | null = null;
    if (customer_id) {
      const customerResult = await db.query(
        `SELECT id, name, whatsapp_number, phone, loyalty_points, credit_limit, payment_terms
         FROM customers WHERE id = $1 AND company_id = $2 LIMIT 1`,
        [customer_id, company_id]
      );
      customer = customerResult.rows[0] ?? null;
      if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Loyalty redemption is a discount on the cart
    const posSettings = await getPosSettingsWithDb(db, company_id);
    const redeemPoints = Math.floor(Number(loyalty_points_redeemed) || 0);
    let loyaltyDiscount = 0;
    if (redeemPoints > 0) {
      if (!customer) return NextResponse.json({ error: 'Choose a customer to redeem points' }, { status: 400 });
      if (!posSettings.loyalty.enabled) return NextResponse.json({ error: 'Loyalty points are turned off' }, { status: 400 });
      if (redeemPoints < posSettings.loyalty.min_redeem_points) {
        return NextResponse.json({ error: `At least ${posSettings.loyalty.min_redeem_points} points must be redeemed at a time` }, { status: 400 });
      }
      const beforeLoyalty = pricePosCart(items, cart_discount);
      const maxPoints = maxRedeemablePoints(Number(customer.loyalty_points), beforeLoyalty.subtotal, posSettings.loyalty);
      if (redeemPoints > maxPoints) {
        return NextResponse.json({ error: `Only ${maxPoints} points can be used on this sale` }, { status: 400 });
      }
      loyaltyDiscount = loyaltyRedemptionValue(redeemPoints, posSettings.loyalty);
    }

    const priced = pricePosCart(items, Number(cart_discount || 0) + loyaltyDiscount);
    const total = priced.total;
    const totalTendered = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const amountPaid = Math.min(totalTendered, total);
    const unpaid = Math.round((total - amountPaid) * 100) / 100;

    if (unpaid > 0.01) {
      if (!pay_later) return NextResponse.json({ error: 'Payment amount is less than total' }, { status: 400 });
      if (!customer) return NextResponse.json({ error: 'Choose a customer to sell on credit' }, { status: 400 });

      // A credit limit of 0 / empty means no limit (customers are created with 0 by default)
      const limit = Number(customer.credit_limit || 0);
      if (limit > 0) {
        const balanceResult = await db.query<{ balance: string }>('SELECT calculate_customer_balance($1) AS balance', [customer.id]);
        const owed = Number(balanceResult.rows[0]?.balance || 0);
        if (owed + unpaid > limit + 0.01) {
          return NextResponse.json(
            { error: `Credit limit exceeded: ${customer.name} owes ${owed.toFixed(2)} of a ${limit.toFixed(2)} limit` },
            { status: 400 }
          );
        }
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const periodError = await validatePeriodLockWithDb(db, today, company_id);
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 400 });
    }

    const status = unpaid <= 0.01 ? 'paid' : amountPaid > 0 ? 'partial' : 'sent';
    const paymentTerms = unpaid > 0.01 ? Number(customer?.payment_terms ?? 30) : 0;

    // One transaction: a failure part-way (e.g. a missing account) leaves no half-recorded sale
    const result = await db.transaction(async (tx) => {
      const invoiceResult = await tx.query(
        `INSERT INTO invoices (
           company_id, customer_id, invoice_number, document_type,
           invoice_date, due_date, status, currency,
           subtotal, tax_amount, discount_amount, total, amount_paid,
           pos_session_id, notes
         ) VALUES (
           $1, $2, generate_pos_sale_number(), 'pos_sale',
           CURRENT_DATE, CURRENT_DATE + $3::int, $4, $5,
           $6, $7, $8, $9, $10,
           $11, $12
         ) RETURNING *`,
        [
          company_id, customer?.id || null, paymentTerms, status, currency,
          priced.subtotal, priced.tax, priced.discount, total, amountPaid,
          session_id, notes || null,
        ]
      );
      const invoice = invoiceResult.rows[0];

      for (let idx = 0; idx < priced.lines.length; idx++) {
        const line = priced.lines[idx];
        await tx.query(
          `INSERT INTO invoice_lines (
             invoice_id, product_id, description, line_number, quantity, unit_price,
             discount_amount, tax_rate, tax_amount, line_total
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            invoice.id,
            line.product_id || null,
            line.name,
            idx + 1,
            line.quantity,
            line.unit_price,
            line.line_discount + line.allocated_discount,
            line.tax_rate || 0,
            line.tax,
            line.net,
          ]
        );
      }

      // Stock out at FIFO cost. A till sale is not refused when recorded stock is too low:
      // the goods are physically at the counter, so the count is what is wrong.
      const inventoryResult = await reduceInventoryForInvoiceWithDb(
        tx,
        invoice.id,
        priced.lines.map((line) => ({ product_id: line.product_id, quantity: line.quantity, description: `POS sale ${invoice.invoice_number}` })),
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
          total,
          tax_amount: priced.tax,
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
      let remainingToApply = amountPaid;
      for (const payment of payments) {
        const amount = Math.min(Number(payment.amount), remainingToApply);
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
            customer?.id || null,
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

      // Loyalty: spend redeemed points, earn on the money paid now
      let loyaltyBalance: number | null = null;
      let pointsEarned = 0;
      if (customer) {
        if (redeemPoints > 0) {
          loyaltyBalance = await recordLoyaltyWithDb(tx, {
            companyId: company_id, customerId: customer.id, points: -redeemPoints, type: 'redeem',
            invoiceId: invoice.id, userId: user.id,
          });
        }
        pointsEarned = loyaltyPointsEarned(amountPaid, posSettings.loyalty);
        if (pointsEarned > 0 || loyaltyBalance === null) {
          loyaltyBalance = await recordLoyaltyWithDb(tx, {
            companyId: company_id, customerId: customer.id, points: pointsEarned, type: 'earn',
            invoiceId: invoice.id, userId: user.id,
          });
        }
        await recalculateCustomerBalanceWithDb(tx, customer.id);
      }

      await tx.query(
        `UPDATE pos_sessions SET
           total_sales = total_sales + $2,
           transaction_count = transaction_count + 1,
           updated_at = NOW()
         WHERE id = $1`,
        [session_id, total]
      );

      return { invoice, loyaltyBalance, pointsEarned };
    });

    // WhatsApp confirmation after the response is sent; a failure never affects the sale
    const whatsappNumber = customer?.whatsapp_number || null;
    if (customer && whatsappNumber) {
      const itemsText = priced.lines.map((l) => `${l.name} x${l.quantity}`).join(', ');
      const amountText = `${currency} ${amountPaid.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
      after(() =>
        sendOrderConfirmationWithDb(getDbProvider(), {
          companyId: company_id,
          invoiceId: result.invoice.id,
          customerName: customer!.name,
          whatsappNumber,
          amountText,
          itemsText,
        })
      );
    }

    return NextResponse.json(
      {
        data: result.invoice,
        totals: priced,
        loyalty: customer
          ? { points_redeemed: redeemPoints, points_earned: result.pointsEarned, balance: result.loyaltyBalance }
          : null,
        balance_due: unpaid > 0.01 ? unpaid : 0,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
