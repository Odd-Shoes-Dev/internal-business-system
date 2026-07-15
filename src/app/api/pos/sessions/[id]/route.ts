import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser, requireCompanyAccess } from '@/lib/provider/route-guards';

// GET /api/pos/sessions/[id] — single session detail with transactions
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await context.params;

    const sessionResult = await db.query(
      `SELECT
         s.*,
         t.name AS terminal_name,
         p.full_name AS opened_by_name,
         pc.full_name AS closed_by_name
       FROM pos_sessions s
       LEFT JOIN pos_terminals t ON t.id = s.terminal_id
       LEFT JOIN user_profiles p ON p.id = s.opened_by
       LEFT JOIN user_profiles pc ON pc.id = s.closed_by
       WHERE s.id = $1 LIMIT 1`,
      [id]
    );
    const session = sessionResult.rows[0];
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const companyAccessError = await requireCompanyAccess(user.id, session.company_id);
    if (companyAccessError) return companyAccessError;

    // Load transactions for this session
    const txResult = await db.query(
      `SELECT
         i.id, i.invoice_number, i.total, i.currency, i.created_at,
         c.name AS customer_name
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.pos_session_id = $1
       ORDER BY i.created_at DESC`,
      [id]
    );

    return NextResponse.json({ data: session, transactions: txResult.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/pos/sessions/[id] — close a session
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await context.params;
    const body = await request.json();

    const sessionResult = await db.query(
      `SELECT * FROM pos_sessions WHERE id = $1 LIMIT 1`,
      [id]
    );
    const session = sessionResult.rows[0];
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const companyAccessError = await requireCompanyAccess(user.id, session.company_id);
    if (companyAccessError) return companyAccessError;

    if (session.status === 'closed') {
      return NextResponse.json({ error: 'Session is already closed' }, { status: 400 });
    }

    const { closing_cash_count, notes } = body;

    // Calculate expected cash = opening float + total cash sales
    const cashSalesResult = await db.query(
      `SELECT COALESCE(SUM(pr.amount), 0) AS cash_total
       FROM payments_received pr
       WHERE pr.pos_session_id = $1 AND pr.payment_method = 'cash'`,
      [id]
    );
    const cashSales = Number(cashSalesResult.rows[0]?.cash_total || 0);
    const expectedCash = Number(session.opening_float) + cashSales;
    const variance = closing_cash_count != null ? Number(closing_cash_count) - expectedCash : null;

    const result = await db.query(
      `UPDATE pos_sessions SET
         status = 'closed',
         closed_by = $2,
         closed_at = NOW(),
         closing_cash_count = $3,
         expected_cash = $4,
         variance = $5,
         notes = COALESCE($6, notes),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, user.id, closing_cash_count ?? null, expectedCash, variance, notes ?? null]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
