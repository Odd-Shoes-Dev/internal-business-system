import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/bookings/[id]/costs - Get booking costs
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id: bookingId } = await context.params;

    const bookingResult = await db.query('SELECT id, company_id FROM bookings WHERE id = $1 LIMIT 1', [bookingId]);
    const booking = bookingResult.rows[0];
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, booking.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const result = await db.query(
      `SELECT bc.*,
              v.id AS vendor_ref_id,
              v.name AS vendor_name,
              e.id AS employee_ref_id,
              e.first_name AS employee_first_name,
              e.last_name AS employee_last_name,
              ex.id AS expense_ref_id,
              ex.expense_number
       FROM booking_costs bc
       LEFT JOIN vendors v ON v.id = bc.vendor_id
       LEFT JOIN employees e ON e.id = bc.employee_id
       LEFT JOIN expenses ex ON ex.id = bc.expense_id
       WHERE bc.booking_id = $1
       ORDER BY bc.cost_date DESC`,
      [bookingId]
    );

    const costs = result.rows.map((row: any) => ({
      ...row,
      vendor: row.vendor_ref_id ? { id: row.vendor_ref_id, name: row.vendor_name } : null,
      employee: row.employee_ref_id
        ? {
            id: row.employee_ref_id,
            first_name: row.employee_first_name,
            last_name: row.employee_last_name,
          }
        : null,
      expense: row.expense_ref_id ? { id: row.expense_ref_id, expense_number: row.expense_number } : null,
    }));

    const totalCosts = costs.reduce((sum: number, cost: any) => sum + Number(cost.amount || 0), 0);
    const costsByType = costs.reduce((acc: any, cost: any) => {
      acc[cost.cost_type] = (acc[cost.cost_type] || 0) + Number(cost.amount || 0);
      return acc;
    }, {});

    return NextResponse.json({ costs, total_costs: totalCosts, costs_by_type: costsByType });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bookings/[id]/costs - Add cost to booking
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id: bookingId } = await context.params;
    const body = await request.json();

    if (!body.cost_type || !body.description || !body.amount || !body.cost_date) {
      return NextResponse.json(
        { error: 'Missing required fields: cost_type, description, amount, cost_date' },
        { status: 400 }
      );
    }

    const bookingResult = await db.query('SELECT id, booking_number, company_id FROM bookings WHERE id = $1 LIMIT 1', [bookingId]);
    const booking = bookingResult.rows[0];

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, booking.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const insertResult = await db.query(
      `INSERT INTO booking_costs (
         booking_id, cost_type, description, amount, currency, exchange_rate,
         vendor_id, employee_id, expense_id, cost_date, notes, created_by
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10::date, $11, $12
       )
       RETURNING *`,
      [
        bookingId,
        body.cost_type,
        body.description,
        body.amount,
        body.currency || 'USD',
        body.exchange_rate || 1,
        body.vendor_id || null,
        body.employee_id || null,
        body.expense_id || null,
        body.cost_date,
        body.notes || null,
        user.id,
      ]
    );

    const created = insertResult.rows[0];

    const joinedResult = await db.query(
      `SELECT bc.*,
              v.id AS vendor_ref_id,
              v.name AS vendor_name,
              e.id AS employee_ref_id,
              e.first_name AS employee_first_name,
              e.last_name AS employee_last_name
       FROM booking_costs bc
       LEFT JOIN vendors v ON v.id = bc.vendor_id
       LEFT JOIN employees e ON e.id = bc.employee_id
       WHERE bc.id = $1
       LIMIT 1`,
      [created.id]
    );

    const row = joinedResult.rows[0];
    const data = {
      ...row,
      vendor: row.vendor_ref_id ? { id: row.vendor_ref_id, name: row.vendor_name } : null,
      employee: row.employee_ref_id
        ? {
            id: row.employee_ref_id,
            first_name: row.employee_first_name,
            last_name: row.employee_last_name,
          }
        : null,
    };

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
