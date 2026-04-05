import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/payroll/payslips/[id] - Get payslip details
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

    const result = await db.query(
      `SELECT pps.*,
              e.id AS employee_ref_id,
              e.employee_id,
              e.first_name,
              e.last_name,
              e.email AS employee_email,
              e.department,
              e.position,
              pp.id AS period_ref_id,
              pp.period_start,
              pp.period_end,
              pp.payment_date,
              pp.status AS period_status,
              pp.company_id
       FROM payroll_payslips pps
       LEFT JOIN employees e ON e.id = pps.employee_id
       LEFT JOIN payroll_periods pp ON pp.id = pps.payroll_period_id
       WHERE pps.id = $1
       LIMIT 1`,
      [id]
    );

    const payslip = result.rows[0];

    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, payslip.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const data = {
      ...payslip,
      employee: payslip.employee_ref_id
        ? {
            id: payslip.employee_ref_id,
            employee_id: payslip.employee_id,
            first_name: payslip.first_name,
            last_name: payslip.last_name,
            email: payslip.employee_email,
            department: payslip.department,
            position: payslip.position,
          }
        : null,
      period: payslip.period_ref_id
        ? {
            id: payslip.period_ref_id,
            period_start: payslip.period_start,
            period_end: payslip.period_end,
            payment_date: payslip.payment_date,
            status: payslip.period_status,
          }
        : null,
    };

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/payroll/payslips/[id] - Update payslip (only if period is draft)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;
    const body = await request.json();

    // Check payslip exists and period is draft
    const payslipResult = await db.query(
      `SELECT pps.*, pp.id AS period_ref_id, pp.status AS period_status, pp.company_id
       FROM payroll_payslips pps
       LEFT JOIN payroll_periods pp ON pp.id = pps.payroll_period_id
       WHERE pps.id = $1
       LIMIT 1`,
      [id]
    );
    const payslip = payslipResult.rows[0];

    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, payslip.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (payslip.period_status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only update payslips for draft periods' },
        { status: 400 }
      );
    }

    // Allow updating specific fields
    const allowedFields = [
      'basic_salary',
      'allowances',
      'housing_allowance',
      'transport_allowance',
      'other_allowances',
      'deductions',
      'tax_deduction',
      'nhif_deduction',
      'nssf_deduction',
      'loan_deduction',
      'advance_deduction',
      'days_worked',
      'notes',
    ];

    const updates: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Recalculate gross and net if components changed
    if (updates.basic_salary !== undefined || updates.allowances !== undefined) {
      const basicSalary = Number(updates.basic_salary ?? payslip.basic_salary ?? 0);
      const allowances = Number(updates.allowances ?? payslip.allowances ?? 0);
      updates.gross_salary = basicSalary + allowances;
    }

    if (updates.deductions !== undefined || updates.gross_salary !== undefined) {
      const grossSalary = Number(updates.gross_salary ?? payslip.gross_salary ?? 0);
      const deductions = Number(updates.deductions ?? payslip.deductions ?? 0);
      updates.net_salary = grossSalary - deductions;
    }

    const setParts: string[] = [];
    const paramsList: any[] = [id];
    for (const [key, value] of Object.entries(updates)) {
      paramsList.push(value);
      setParts.push(`${key} = $${paramsList.length}`);
    }

    if (setParts.length === 0) {
      return NextResponse.json(payslip);
    }

    // Update payslip
    const updatedPayslipResult = await db.query(
      `UPDATE payroll_payslips
       SET ${setParts.join(', ')}
       WHERE id = $1
       RETURNING *`,
      paramsList
    );

    const updatedPayslip = updatedPayslipResult.rows[0];

    return NextResponse.json(updatedPayslip);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/payroll/payslips/[id] - Delete payslip (only if period is draft)
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

    // Check payslip exists and period is draft
    const payslipResult = await db.query(
      `SELECT pps.id, pp.status AS period_status, pp.company_id
       FROM payroll_payslips pps
       LEFT JOIN payroll_periods pp ON pp.id = pps.payroll_period_id
       WHERE pps.id = $1
       LIMIT 1`,
      [id]
    );
    const payslip = payslipResult.rows[0];

    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, payslip.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (payslip.period_status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only delete payslips for draft periods' },
        { status: 400 }
      );
    }

    // Delete payslip
    await db.query('DELETE FROM payroll_payslips WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Payslip deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
