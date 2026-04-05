import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/vendors/[id]
export async function GET(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const vendorResult = await db.query(
      `SELECT v.*, a.id AS default_expense_account_ref_id, a.name AS default_expense_account_name, a.code AS default_expense_account_code
       FROM vendors v
       LEFT JOIN accounts a ON a.id = v.default_expense_account_id
       WHERE v.id = $1
       LIMIT 1`,
      [params.id]
    );

    if (!vendorResult.rowCount) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const vendor = vendorResult.rows[0] as any;
    const accessError = await requireCompanyAccess(user.id, vendor.company_id);
    if (accessError) return accessError;

    // Get recent bills
    const bills = await db.query(
      `SELECT id, bill_number, bill_date, total, amount_paid, status
       FROM bills
       WHERE vendor_id = $1
       ORDER BY bill_date DESC
       LIMIT 10`,
      [params.id]
    );

    return NextResponse.json({
      data: {
        ...vendor,
        accounts: vendor.default_expense_account_ref_id
          ? {
              id: vendor.default_expense_account_ref_id,
              name: vendor.default_expense_account_name,
              code: vendor.default_expense_account_code,
            }
          : null,
        recent_bills: bills.rows || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/vendors/[id]
export async function PATCH(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const body = await request.json();

    const existing = await db.query('SELECT id, company_id FROM vendors WHERE id = $1 LIMIT 1', [params.id]);
    if (!existing.rowCount) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, (existing.rows[0] as any).company_id);
    if (accessError) return accessError;

    const fields = Object.keys(body);
    if (!fields.length) {
      const current = await db.query('SELECT * FROM vendors WHERE id = $1 LIMIT 1', [params.id]);
      return NextResponse.json({ data: current.rows[0] });
    }

    const setSql = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
    const values = fields.map((field) => body[field]);
    values.push(params.id);

    const updated = await db.query(
      `UPDATE vendors
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

// DELETE /api/vendors/[id]
export async function DELETE(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const vendor = await db.query('SELECT id, company_id FROM vendors WHERE id = $1 LIMIT 1', [params.id]);
    if (!vendor.rowCount) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, (vendor.rows[0] as any).company_id);
    if (accessError) return accessError;

    // Check for existing bills
    const billCount = await db.query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM bills WHERE vendor_id = $1',
      [params.id]
    );
    const count = Number(billCount.rows[0]?.total || 0);

    if (count && count > 0) {
      const data = await db.query(
        'UPDATE vendors SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *',
        [params.id]
      );

      return NextResponse.json({
        data: data.rows[0],
        message: 'Vendor deactivated (has existing bills)',
      });
    }

    await db.query('DELETE FROM vendors WHERE id = $1', [params.id]);

    return NextResponse.json({ message: 'Vendor deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
