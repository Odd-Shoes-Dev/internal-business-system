import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/payroll/periods - List payroll periods
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const year = url.searchParams.get('year');

    const where: string[] = ['pp.company_id = $1'];
    const params: any[] = [companyId];
    if (status) {
      params.push(status);
      where.push(`pp.status = $${params.length}`);
    }

    if (year) {
      const yearInt = parseInt(year, 10);
      params.push(`${yearInt}-01-01`);
      where.push(`pp.start_date >= $${params.length}::date`);
      params.push(`${yearInt}-12-31`);
      where.push(`pp.start_date <= $${params.length}::date`);
    }

    const periodsResult = await db.query(
      `SELECT pp.*,
              up.id AS processed_by_user_id,
              up.full_name AS processed_by_user_full_name,
              up.email AS processed_by_user_email
       FROM payroll_periods pp
       LEFT JOIN user_profiles up ON up.id = pp.processed_by
       WHERE ${where.join(' AND ')}
       ORDER BY pp.start_date DESC`,
      params
    );

    const periods = periodsResult.rows.map((row: any) => ({
      ...row,
      processed_by_user: row.processed_by_user_id
        ? {
            id: row.processed_by_user_id,
            full_name: row.processed_by_user_full_name,
            email: row.processed_by_user_email,
          }
        : null,
    }));

    return NextResponse.json(periods);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/payroll/periods - Create a new payroll period
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const body = await request.json();
    const { start_date, end_date, payment_date, working_days, period_name, period_type } = body;

    // Validate required fields
    if (!period_name || !period_name.trim()) {
      return NextResponse.json({ error: 'period_name is required' }, { status: 400 });
    }
    if (!start_date || !end_date || !payment_date) {
      return NextResponse.json(
        { error: 'start_date, end_date, and payment_date are required' },
        { status: 400 }
      );
    }

    // Validate dates
    const start = new Date(start_date);
    const end = new Date(end_date);
    const payment = new Date(payment_date);

    if (start >= end) {
      return NextResponse.json(
        { error: 'end_date must be after start_date' },
        { status: 400 }
      );
    }

    if (payment < end) {
      return NextResponse.json(
        { error: 'payment_date must be on or after end_date' },
        { status: 400 }
      );
    }

    // Check for overlapping periods
    const existingResult = await db.query(
      `SELECT id
       FROM payroll_periods
       WHERE company_id = $1
         AND start_date <= $2::date
         AND end_date >= $3::date
       LIMIT 1`,
      [companyId, end_date, start_date]
    );
    const existing = existingResult.rows;

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'A payroll period already exists that overlaps with this date range' },
        { status: 400 }
      );
    }

    // Create the payroll period
    const periodResult = await db.query(
      `INSERT INTO payroll_periods (
         company_id, period_name, period_type, start_date, end_date, payment_date, status, working_days
       ) VALUES ($1, $2, $3, $4::date, $5::date, $6::date, 'draft', $7)
       RETURNING *`,
      [companyId, period_name, period_type || 'monthly', start_date, end_date, payment_date, working_days ?? null]
    );

    const period = periodResult.rows[0];

    return NextResponse.json(period, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
