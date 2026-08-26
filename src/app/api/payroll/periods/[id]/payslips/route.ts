import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';
import { getRatesMap } from '@/lib/exchange-rates';
import { calculatePayslip } from '@/lib/payroll/calculate-payslip';

// POST /api/payroll/periods/[id]/payslips - Add a single payslip to a draft period
// (e.g. a new hire, someone excluded during processing, or a re-added deleted payslip)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id: periodId } = await params;
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const body = await request.json().catch(() => ({}));
    const employeeId = body.employee_id;
    if (!employeeId) {
      return NextResponse.json({ error: 'employee_id is required' }, { status: 400 });
    }

    const periodResult = await db.query(
      `SELECT * FROM payroll_periods WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [periodId, companyId]
    );
    const period = periodResult.rows[0];
    if (!period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }
    if (period.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only add payslips to draft periods' },
        { status: 400 }
      );
    }

    // Prevent duplicate payslips for the same employee in this period
    const existingResult = await db.query(
      `SELECT id FROM payroll_payslips WHERE payroll_period_id = $1 AND employee_id = $2 LIMIT 1`,
      [periodId, employeeId]
    );
    if (existingResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'This employee already has a payslip for this period' },
        { status: 400 }
      );
    }

    const employeeResult = await db.query(
      `SELECT * FROM employees WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [employeeId, companyId]
    );
    const employee = employeeResult.rows[0];
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const settingsResult = await db.query(
      `SELECT nssf_employee_rate, nssf_employer_rate
       FROM company_settings WHERE company_id = $1 LIMIT 1`,
      [companyId]
    );
    const settings = settingsResult.rows[0] || {};
    const nssfEmployeeRate = Number(settings.nssf_employee_rate ?? 0) / 100;
    const nssfEmployerRate = Number(settings.nssf_employer_rate ?? 0) / 100;

    const companyResult = await db.query('SELECT currency FROM companies WHERE id = $1 LIMIT 1', [companyId]);
    const companyCurrency = companyResult.rows[0]?.currency || 'USD';
    const ratesMap = await getRatesMap(db, companyCurrency);

    const start = new Date(period.start_date);
    const end = new Date(period.end_date);
    const calendarDaysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const workingDaysInPeriod: number = period.working_days ?? calendarDaysInPeriod;
    const daysWorked: number = body.days_worked ?? workingDaysInPeriod;

    const calc = calculatePayslip({
      employee,
      daysWorked,
      workingDaysInPeriod,
      companyCurrency,
      ratesMap,
      nssfEmployeeRate,
      nssfEmployerRate,
      isSubjectToPaye: body.paye !== false,
      isSubjectToNssf: body.nssf !== false,
    });

    const insertResult = await db.query(
      `INSERT INTO payroll_payslips (
         payroll_period_id, employee_id, basic_salary, allowances,
         housing_allowance, transport_allowance, other_allowances,
         gross_salary, deductions, tax_deduction, nhif_deduction,
         nssf_deduction, nssf_employee, nssf_employer,
         loan_deduction, advance_deduction,
         net_salary, days_worked, status, created_by
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14,
         $15, $16,
         $17, $18, $19, $20
       )
       RETURNING *`,
      [
        periodId,
        calc.employee_id,
        calc.basic_salary,
        calc.allowances,
        calc.housing_allowance,
        calc.transport_allowance,
        calc.other_allowances,
        calc.gross_salary,
        calc.deductions,
        calc.tax_deduction,
        calc.nhif_deduction,
        calc.nssf_deduction,
        calc.nssf_employee,
        calc.nssf_employer,
        calc.loan_deduction,
        calc.advance_deduction,
        calc.net_salary,
        calc.days_worked,
        'pending',
        user.id,
      ]
    );

    // Recalculate period totals from all payslips
    const totalsResult = await db.query(
      `SELECT
         COALESCE(SUM(gross_salary), 0) AS total_gross,
         COALESCE(SUM(deductions), 0) AS total_deductions,
         COALESCE(SUM(net_salary), 0) AS total_net,
         COUNT(*) AS employee_count
       FROM payroll_payslips
       WHERE payroll_period_id = $1`,
      [periodId]
    );
    const totals = totalsResult.rows[0];

    await db.query(
      `UPDATE payroll_periods
       SET total_gross = $2,
           total_deductions = $3,
           total_net = $4,
           employee_count = $5,
           updated_at = NOW()
       WHERE id = $1`,
      [periodId, totals.total_gross, totals.total_deductions, totals.total_net, totals.employee_count]
    );

    return NextResponse.json({
      message: 'Payslip added successfully',
      payslip: insertResult.rows[0],
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
