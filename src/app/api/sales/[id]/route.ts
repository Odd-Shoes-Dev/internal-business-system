import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/sales/[id] — one sale with its lines, payments and returns
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await params;
    const saleResult = await db.query(
      `SELECT i.*, c.name AS customer_name, c.phone AS customer_phone,
              t.name AS terminal_name, u.full_name AS cashier_name
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       LEFT JOIN pos_sessions s ON s.id = i.pos_session_id
       LEFT JOIN pos_terminals t ON t.id = s.terminal_id
       LEFT JOIN app_users u ON u.id = s.opened_by
       WHERE i.id = $1 AND i.document_type IN ('invoice', 'pos_sale')`,
      [id]
    );
    const sale = saleResult.rows[0];
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

    const accessError = await requireCompanyAccess(user.id, sale.company_id);
    if (accessError) return accessError;

    const [lines, payments, returns] = await Promise.all([
      db.query(
        `SELECT id, product_id, description, quantity::float AS quantity, unit_price::float AS unit_price,
                COALESCE(discount_amount, 0)::float AS discount_amount, COALESCE(tax_amount, 0)::float AS tax_amount,
                line_total::float AS line_total
         FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_number`,
        [id]
      ),
      db.query(
        `SELECT pr.payment_number, pr.payment_date, pr.payment_method, pr.reference_number, pr.source,
                pa.amount_applied::float AS amount
         FROM payment_applications pa JOIN payments_received pr ON pr.id = pa.payment_id
         WHERE pa.invoice_id = $1 ORDER BY pr.created_at`,
        [id]
      ),
      db.query(
        `SELECT return_number, created_at, refund_method, reason, total::float AS total
         FROM pos_returns WHERE invoice_id = $1 ORDER BY created_at`,
        [id]
      ),
    ]);

    return NextResponse.json({ data: { ...sale, lines: lines.rows, payments: payments.rows, returns: returns.rows } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
