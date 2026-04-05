import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

async function resolveCompanyId(db: any, userId: string, request: NextRequest): Promise<string | null> {
  const requestedCompanyId = getCompanyIdFromRequest(request);
  if (requestedCompanyId) {
    return requestedCompanyId;
  }

  const companyResult = await db.query(
    `SELECT company_id
     FROM user_companies
     WHERE user_id = $1
     ORDER BY is_primary DESC, joined_at ASC
     LIMIT 1`,
    [userId]
  );

  return companyResult.rows[0]?.company_id || null;
}

// GET /api/commissions - List commissions with filters
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const companyId = await resolveCompanyId(db, user.id, request);
    if (!companyId) {
      return NextResponse.json({ error: 'No company found for user' }, { status: 403 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const { searchParams } = new URL(request.url);

    const commissionType = searchParams.get('commission_type');
    const status = searchParams.get('status');
    const bookingId = searchParams.get('booking_id');
    const employeeId = searchParams.get('employee_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const where: string[] = ['c.company_id = $1'];
    const params: any[] = [companyId];

    if (commissionType) {
      params.push(commissionType);
      where.push(`c.commission_type = $${params.length}`);
    }

    if (status) {
      params.push(status);
      where.push(`c.status = $${params.length}`);
    }

    if (bookingId) {
      params.push(bookingId);
      where.push(`c.booking_id = $${params.length}`);
    }

    if (employeeId) {
      params.push(employeeId);
      where.push(`c.employee_id = $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM commissions c
       ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const dataResult = await db.query(
      `SELECT c.*,
              b.id AS booking_ref_id,
              b.booking_number,
              i.id AS invoice_ref_id,
              i.invoice_number,
              e.id AS employee_ref_id,
              e.first_name AS employee_first_name,
              e.last_name AS employee_last_name,
              v.id AS vendor_ref_id,
              v.name AS vendor_name
       FROM commissions c
       LEFT JOIN bookings b ON b.id = c.booking_id
       LEFT JOIN invoices i ON i.id = c.invoice_id
       LEFT JOIN employees e ON e.id = c.employee_id
       LEFT JOIN vendors v ON v.id = c.vendor_id
       ${whereSql}
       ORDER BY c.commission_date DESC
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const data = dataResult.rows.map((row: any) => ({
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
          }
        : null,
      vendor: row.vendor_ref_id
        ? {
            id: row.vendor_ref_id,
            name: row.vendor_name,
          }
        : null,
    }));

    const total = Number(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/commissions - Create commission
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const companyId = body.company_id || getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (!body.commission_type || !body.commission_date) {
      return NextResponse.json(
        { error: 'Missing required fields: commission_type, commission_date' },
        { status: 400 }
      );
    }

    let commissionAmount = body.commission_amount;
    if (body.commission_rate && body.base_amount) {
      commissionAmount = Number(body.base_amount) * (Number(body.commission_rate) / 100);
    }

    if (!commissionAmount || Number(commissionAmount) <= 0) {
      return NextResponse.json({ error: 'Commission amount must be greater than zero' }, { status: 400 });
    }

    const insertResult = await db.query(
      `INSERT INTO commissions (
         company_id, commission_type, booking_id, invoice_id, employee_id, vendor_id,
         commission_rate, base_amount, commission_amount, currency, exchange_rate,
         commission_date, payment_date, status, notes, created_by
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12::date, $13::date, $14, $15, $16
       )
       RETURNING *`,
      [
        companyId,
        body.commission_type,
        body.booking_id || null,
        body.invoice_id || null,
        body.employee_id || null,
        body.vendor_id || null,
        body.commission_rate || null,
        body.base_amount || null,
        Number(commissionAmount),
        body.currency || 'USD',
        body.exchange_rate || 1,
        body.commission_date,
        body.payment_date || null,
        body.status || 'pending',
        body.notes || null,
        user.id,
      ]
    );

    const created = insertResult.rows[0];

    const joinedResult = await db.query(
      `SELECT c.*,
              b.id AS booking_ref_id,
              b.booking_number,
              i.id AS invoice_ref_id,
              i.invoice_number,
              e.id AS employee_ref_id,
              e.first_name AS employee_first_name,
              e.last_name AS employee_last_name,
              v.id AS vendor_ref_id,
              v.name AS vendor_name
       FROM commissions c
       LEFT JOIN bookings b ON b.id = c.booking_id
       LEFT JOIN invoices i ON i.id = c.invoice_id
       LEFT JOIN employees e ON e.id = c.employee_id
       LEFT JOIN vendors v ON v.id = c.vendor_id
       WHERE c.id = $1
       LIMIT 1`,
      [created.id]
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
          }
        : null,
      vendor: row.vendor_ref_id
        ? {
            id: row.vendor_ref_id,
            name: row.vendor_name,
          }
        : null,
    };

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
