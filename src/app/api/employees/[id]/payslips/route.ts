import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await context.params;

    const employeeResult = await db.query('SELECT id, company_id FROM employees WHERE id = $1 LIMIT 1', [id]);
    const employee = employeeResult.rows[0];
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, employee.company_id);
    if (accessError) return accessError;

    const result = await db.query(
      `SELECT p.*, pp.period_name, pp.payment_date
       FROM payslips p
       LEFT JOIN payroll_periods pp ON pp.id = p.payroll_period_id
       WHERE p.employee_id = $1
       ORDER BY p.created_at DESC
       LIMIT 10`,
      [id]
    );

    return NextResponse.json({
      data: result.rows.map((row: any) => ({
        ...row,
        payroll_period: row.period_name
          ? {
              period_name: row.period_name,
              payment_date: row.payment_date,
            }
          : null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
