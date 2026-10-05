import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/sales — completed sales (POS sales and invoices) with filters and totals.
// Params: company_id, from, to (YYYY-MM-DD), source (all|pos|invoice), status (paid|unpaid),
// method (cash|card|mobile_money|...), session_id, search, page, limit, format=csv
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const sp = new URL(request.url).searchParams;
    const params: any[] = [companyId];
    const where: string[] = [
      'i.company_id = $1',
      // Completed sales only: no drafts, quotations, proformas or voided documents
      `i.document_type IN ('invoice', 'pos_sale')`,
      `i.status NOT IN ('draft', 'void', 'cancelled')`,
    ];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };

    if (sp.get('from')) add('i.invoice_date >= ?::date', sp.get('from'));
    if (sp.get('to')) add('i.invoice_date <= ?::date', sp.get('to'));
    if (sp.get('source') === 'pos') where.push(`i.document_type = 'pos_sale'`);
    if (sp.get('source') === 'invoice') where.push(`i.document_type = 'invoice'`);
    if (sp.get('status') === 'paid') where.push('i.total - i.amount_paid <= 0.01');
    if (sp.get('status') === 'unpaid') where.push('i.total - i.amount_paid > 0.01');
    if (sp.get('session_id')) add('i.pos_session_id = ?', sp.get('session_id'));
    if (sp.get('method')) {
      add(`EXISTS (SELECT 1 FROM payment_applications pa JOIN payments_received pr ON pr.id = pa.payment_id
                   WHERE pa.invoice_id = i.id AND pr.payment_method::text = ?)`, sp.get('method'));
    }
    if (sp.get('search')) {
      params.push(`%${sp.get('search')}%`);
      where.push(`(i.invoice_number ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }
    const whereSql = where.join(' AND ');

    const base = `
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN pos_sessions s ON s.id = i.pos_session_id
      LEFT JOIN pos_terminals t ON t.id = s.terminal_id
      LEFT JOIN app_users u ON u.id = s.opened_by
      WHERE ${whereSql}`;

    const rowsSql = `
      SELECT i.id, i.invoice_number, i.document_type, i.invoice_date, i.created_at, i.status, i.currency,
             i.subtotal::float AS subtotal, COALESCE(i.discount_amount, 0)::float AS discount_amount,
             COALESCE(i.tax_amount, 0)::float AS tax_amount, i.total::float AS total,
             COALESCE(i.amount_paid, 0)::float AS amount_paid,
             GREATEST(i.total - COALESCE(i.amount_paid, 0), 0)::float AS balance_due,
             c.name AS customer_name, t.name AS terminal_name, u.full_name AS cashier_name,
             (SELECT string_agg(DISTINCT pr.payment_method::text, ', ')
                FROM payment_applications pa JOIN payments_received pr ON pr.id = pa.payment_id
               WHERE pa.invoice_id = i.id AND pr.source IS DISTINCT FROM 'pos_return') AS payment_methods,
             COALESCE((SELECT SUM(r.total) FROM pos_returns r WHERE r.invoice_id = i.id), 0)::float AS refunded
      ${base}
      ORDER BY i.invoice_date DESC, i.created_at DESC`;

    const summarySql = `
      SELECT COUNT(*)::int AS count,
             COALESCE(SUM(i.subtotal + COALESCE(i.discount_amount, 0)), 0)::float AS gross,
             COALESCE(SUM(i.discount_amount), 0)::float AS discounts,
             COALESCE(SUM(i.tax_amount), 0)::float AS tax,
             COALESCE(SUM(i.total), 0)::float AS total,
             COALESCE(SUM(i.amount_paid), 0)::float AS paid,
             COALESCE(SUM(GREATEST(i.total - i.amount_paid, 0)), 0)::float AS outstanding,
             COALESCE(SUM((SELECT SUM(r.total) FROM pos_returns r WHERE r.invoice_id = i.id)), 0)::float AS refunded
      ${base}`;

    if (sp.get('format') === 'csv') {
      const all = await db.query(rowsSql, params);
      const header = ['Number', 'Type', 'Date', 'Customer', 'Till', 'Cashier', 'Status', 'Currency', 'Subtotal',
        'Discount', 'Tax', 'Total', 'Paid', 'Balance', 'Refunded', 'Payment methods'];
      const cell = (v: unknown) => {
        const text = v == null ? '' : String(v);
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };
      const lines = all.rows.map((r: any) => [
        r.invoice_number, r.document_type === 'pos_sale' ? 'POS' : 'Invoice', String(r.invoice_date).slice(0, 10),
        r.customer_name, r.terminal_name, r.cashier_name, r.status, r.currency, r.subtotal, r.discount_amount,
        r.tax_amount, r.total, r.amount_paid, r.balance_due, r.refunded, r.payment_methods,
      ].map(cell).join(','));
      return new NextResponse([header.join(','), ...lines].join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="sales-${sp.get('from') || 'all'}-to-${sp.get('to') || 'now'}.csv"`,
        },
      });
    }

    const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '50', 10)));
    const [rows, summary] = await Promise.all([
      db.query(`${rowsSql} LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params),
      db.query(summarySql, params),
    ]);

    const s = summary.rows[0];
    return NextResponse.json({
      data: rows.rows,
      summary: s,
      pagination: { page, limit, total: s.count, totalPages: Math.ceil(s.count / limit) },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
