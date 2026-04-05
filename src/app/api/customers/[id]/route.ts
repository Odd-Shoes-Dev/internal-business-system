import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/customers/[id]
export async function GET(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const customer = await db.query('SELECT * FROM customers WHERE id = $1 LIMIT 1', [params.id]);
    if (!customer.rowCount) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customerRow = customer.rows[0] as any;
    const accessError = await requireCompanyAccess(user.id, customerRow.company_id);
    if (accessError) return accessError;

    // Get recent invoices
    const invoices = await db.query(
      `SELECT id, invoice_number, invoice_date, total, amount_paid, status
       FROM invoices
       WHERE customer_id = $1
       ORDER BY invoice_date DESC
       LIMIT 10`,
      [params.id]
    );

    return NextResponse.json({
      data: {
        ...customerRow,
        recent_invoices: invoices.rows || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/customers/[id]
export async function PATCH(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const body = await request.json();

    // Check customer exists
    const existing = await db.query('SELECT id, company_id FROM customers WHERE id = $1 LIMIT 1', [params.id]);
    if (!existing.rowCount) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, (existing.rows[0] as any).company_id);
    if (accessError) return accessError;

    // Check email uniqueness if updating
    if (body.email) {
      const emailCheck = await db.query(
        'SELECT id FROM customers WHERE email = $1 AND id <> $2 LIMIT 1',
        [body.email, params.id]
      );

      if (emailCheck.rowCount > 0) {
        return NextResponse.json(
          { error: 'A customer with this email already exists' },
          { status: 400 }
        );
      }
    }

    const fields = Object.keys(body);
    if (!fields.length) {
      const current = await db.query('SELECT * FROM customers WHERE id = $1 LIMIT 1', [params.id]);
      return NextResponse.json({ data: current.rows[0] });
    }

    const setSql = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
    const values = fields.map((field) => body[field]);
    values.push(params.id);

    const updated = await db.query(
      `UPDATE customers
       SET ${setSql}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    return NextResponse.json({ data: updated.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/customers/[id]
export async function DELETE(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const customer = await db.query('SELECT id, company_id FROM customers WHERE id = $1 LIMIT 1', [params.id]);
    if (!customer.rowCount) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, (customer.rows[0] as any).company_id);
    if (accessError) return accessError;

    // Check for existing invoices
    const invoiceCount = await db.query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM invoices WHERE customer_id = $1',
      [params.id]
    );
    const count = Number(invoiceCount.rows[0]?.total || 0);

    if (count && count > 0) {
      // Soft delete - deactivate instead
      const data = await db.query(
        'UPDATE customers SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *',
        [params.id]
      );

      return NextResponse.json({
        data: data.rows[0],
        message: 'Customer deactivated (has existing invoices)',
      });
    }

    // Hard delete if no invoices
    await db.query('DELETE FROM customers WHERE id = $1', [params.id]);

    return NextResponse.json({ message: 'Customer deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
