import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser, requireCompanyAccess } from '@/lib/provider/route-guards';

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

    // Generate invoice number
    const countResult = await db.query(
      `SELECT COUNT(*) AS cnt FROM invoices WHERE company_id = $1 AND document_type = 'pos_sale'`,
      [company_id]
    );
    const nextNum = Number(countResult.rows[0].cnt) + 1;
    const invoiceNumber = `POS-${new Date().getFullYear()}-${String(nextNum).padStart(5, '0')}`;

    // Create invoice (pos_sale)
    const invoiceResult = await db.query(
      `INSERT INTO invoices (
         company_id, customer_id, invoice_number, document_type,
         invoice_date, due_date, status, currency,
         subtotal, tax_amount, total, amount_paid,
         pos_session_id, notes
       ) VALUES (
         $1, $2, $3, 'pos_sale',
         CURRENT_DATE, CURRENT_DATE, 'paid', $4,
         $5, $6, $7, $7,
         $8, $9
       ) RETURNING *`,
      [
        company_id, customer_id || null, invoiceNumber,
        currency, subtotal, taxAmount, total,
        session_id, notes || null,
      ]
    );
    const invoice = invoiceResult.rows[0];

    // Create invoice lines
    for (const item of items) {
      await db.query(
        `INSERT INTO invoice_lines (invoice_id, product_id, description, quantity, unit_price, tax_rate, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          invoice.id,
          item.product_id || null,
          item.name,
          item.quantity,
          item.unit_price,
          item.tax_rate || 0,
          item.unit_price * item.quantity,
        ]
      );
    }

    // Deduct inventory for inventory-type products
    for (const item of items) {
      if (!item.product_id) continue;
      const productResult = await db.query(
        `SELECT track_inventory FROM products WHERE id = $1 LIMIT 1`,
        [item.product_id]
      );
      if (productResult.rows[0]?.track_inventory) {
        await db.query(
          `UPDATE products SET quantity_on_hand = quantity_on_hand - $2, updated_at = NOW() WHERE id = $1`,
          [item.product_id, item.quantity]
        );
        await db.query(
          `INSERT INTO inventory_movements (product_id, company_id, movement_type, quantity, reference_type, reference_id, notes)
           VALUES ($1, $2, 'out', $3, 'pos_sale', $4, 'POS sale')`,
          [item.product_id, company_id, item.quantity, invoice.id]
        );
      }
    }

    // Create payment records (one per payment method)
    for (const payment of payments) {
      await db.query(
        `INSERT INTO payments_received (
           company_id, customer_id, invoice_id, amount, currency,
           payment_date, payment_method, source, pos_session_id,
           reference_number
         ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, 'pos', $7, $8)`,
        [
          company_id,
          customer_id || null,
          invoice.id,
          payment.amount,
          currency,
          payment.method,
          session_id,
          payment.reference || null,
        ]
      );
    }

    // Update session running totals
    await db.query(
      `UPDATE pos_sessions SET
         total_sales = total_sales + $2,
         transaction_count = transaction_count + 1,
         updated_at = NOW()
       WHERE id = $1`,
      [session_id, total]
    );

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
