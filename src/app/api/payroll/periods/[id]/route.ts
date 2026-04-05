import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/payroll/periods/[id] - Get period details with payslips
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;

    const periodResult = await db.query(
      `SELECT pp.*,
              upc.id AS created_by_user_id,
              upc.full_name AS created_by_user_full_name,
              upc.email AS created_by_user_email,
              upp.id AS processed_by_user_id,
              upp.full_name AS processed_by_user_full_name,
              upp.email AS processed_by_user_email
       FROM payroll_periods pp
       LEFT JOIN user_profiles upc ON upc.id = pp.created_by
       LEFT JOIN user_profiles upp ON upp.id = pp.processed_by
       WHERE pp.id = $1
       LIMIT 1`,
      [id]
    );

    const row = periodResult.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, row.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const payslipsResult = await db.query(
      `SELECT pps.*,
              e.id AS employee_ref_id,
              e.first_name,
              e.last_name,
              e.employee_id
       FROM payroll_payslips pps
       LEFT JOIN employees e ON e.id = pps.employee_id
       WHERE pps.payroll_period_id = $1`,
      [id]
    );

    const period = {
      ...row,
      created_by_user: row.created_by_user_id
        ? {
            id: row.created_by_user_id,
            full_name: row.created_by_user_full_name,
            email: row.created_by_user_email,
          }
        : null,
      processed_by_user: row.processed_by_user_id
        ? {
            id: row.processed_by_user_id,
            full_name: row.processed_by_user_full_name,
            email: row.processed_by_user_email,
          }
        : null,
      payslips: payslipsResult.rows.map((p: any) => ({
        ...p,
        employee: p.employee_ref_id
          ? {
              id: p.employee_ref_id,
              first_name: p.first_name,
              last_name: p.last_name,
              employee_id: p.employee_id,
            }
          : null,
      })),
    };

    return NextResponse.json(period);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/payroll/periods/[id] - Delete draft period
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;

    // Check period exists and is draft
    const periodResult = await db.query(
      'SELECT id, company_id, status FROM payroll_periods WHERE id = $1 LIMIT 1',
      [id]
    );
    const period = periodResult.rows[0];

    if (!period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, period.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (period.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only delete draft payroll periods' },
        { status: 400 }
      );
    }

    // Delete the period (cascade will delete payslips)
    await db.query('DELETE FROM payroll_periods WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Payroll period deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
