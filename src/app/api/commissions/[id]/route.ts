import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/commissions/[id] - Get commission details
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const result = await db.query(
      `SELECT c.*,
              b.id AS booking_ref_id,
              b.booking_number,
              i.id AS invoice_ref_id,
              i.invoice_number,
              e.id AS employee_ref_id,
              e.first_name AS employee_first_name,
              e.last_name AS employee_last_name,
              e.email AS employee_email,
              v.id AS vendor_ref_id,
              v.name AS vendor_name,
              v.email AS vendor_email,
              u.id AS approved_by_user_id,
              u.full_name AS approved_by_full_name
       FROM commissions c
       LEFT JOIN bookings b ON b.id = c.booking_id
       LEFT JOIN invoices i ON i.id = c.invoice_id
       LEFT JOIN employees e ON e.id = c.employee_id
       LEFT JOIN vendors v ON v.id = c.vendor_id
       LEFT JOIN user_profiles u ON u.id = c.approved_by
       WHERE c.id = $1
       LIMIT 1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, row.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const data = {
      ...row,
      booking: row.booking_ref_id
        ? {
            id: row.booking_ref_id,
            booking_number: row.booking_number,
          }
        : null,
      invoice: row.invoice_ref_id
        ? {
            id: row.invoice_ref_id,
            invoice_number: row.invoice_number,
          }
        : null,
      employee: row.employee_ref_id
        ? {
            id: row.employee_ref_id,
            first_name: row.employee_first_name,
            last_name: row.employee_last_name,
            email: row.employee_email,
          }
        : null,
      vendor: row.vendor_ref_id
        ? {
            id: row.vendor_ref_id,
            name: row.vendor_name,
            email: row.vendor_email,
          }
        : null,
      approved_by_user: row.approved_by_user_id
        ? {
            id: row.approved_by_user_id,
            full_name: row.approved_by_full_name,
          }
        : null,
    };

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/commissions/[id] - Update commission
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    const existingResult = await db.query('SELECT id, company_id, status FROM commissions WHERE id = $1 LIMIT 1', [id]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (existing.status === 'paid' || existing.status === 'cancelled') {
      return NextResponse.json(
        { error: `Cannot update commission with status: ${existing.status}` },
        { status: 400 }
      );
    }

    const updateResult = await db.query(
      `UPDATE commissions
       SET commission_rate = COALESCE($2, commission_rate),
           base_amount = COALESCE($3, base_amount),
           commission_amount = COALESCE($4, commission_amount),
           payment_date = COALESCE($5::date, payment_date),
           status = COALESCE($6, status),
           notes = COALESCE($7, notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        body.commission_rate ?? null,
        body.base_amount ?? null,
        body.commission_amount ?? null,
        body.payment_date ?? null,
        body.status ?? null,
        body.notes ?? null,
      ]
    );

    const updated = updateResult.rows[0];

    const joinedResult = await db.query(
      `SELECT c.*,
              b.id AS booking_ref_id,
              b.booking_number,
              e.id AS employee_ref_id,
              e.first_name AS employee_first_name,
              e.last_name AS employee_last_name
       FROM commissions c
       LEFT JOIN bookings b ON b.id = c.booking_id
       LEFT JOIN employees e ON e.id = c.employee_id
       WHERE c.id = $1
       LIMIT 1`,
      [updated.id]
    );

    const row = joinedResult.rows[0];
    const data = {
      ...row,
      booking: row.booking_ref_id
        ? {
            id: row.booking_ref_id,
            booking_number: row.booking_number,
          }
        : null,
      employee: row.employee_ref_id
        ? {
            id: row.employee_ref_id,
            first_name: row.employee_first_name,
            last_name: row.employee_last_name,
          }
        : null,
    };

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/commissions/[id] - Cancel commission
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const existingResult = await db.query('SELECT id, company_id, status FROM commissions WHERE id = $1 LIMIT 1', [id]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (existing.status === 'paid') {
      return NextResponse.json({ error: 'Cannot cancel paid commission' }, { status: 400 });
    }

    await db.query('UPDATE commissions SET status = $2, updated_at = NOW() WHERE id = $1', [id, 'cancelled']);

    return NextResponse.json({ message: 'Commission cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
