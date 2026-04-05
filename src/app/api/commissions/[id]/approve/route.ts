import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/commissions/[id]/approve - Approve commission
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const existingResult = await db.query(
      'SELECT id, company_id, status FROM commissions WHERE id = $1 LIMIT 1',
      [id]
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Can only approve pending commissions. Current status: ${existing.status}` },
        { status: 400 }
      );
    }

    const updateResult = await db.query(
      `UPDATE commissions
       SET status = 'approved',
           approved_by = $2,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, user.id]
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
