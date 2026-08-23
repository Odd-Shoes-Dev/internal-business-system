import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/payroll/periods/[id]/generate - Generate payslips for all employees
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

    // Fetch company payroll rates from settings
    const settingsResult = await db.query(
      `SELECT income_tax_rate, nssf_employee_rate, nssf_employer_rate
       FROM company_settings WHERE company_id = $1 LIMIT 1`,
      [companyId]
    );
    const settings = settingsResult.rows[0] || {};
    const incomeTaxRate = Number(settings.income_tax_rate ?? 0) / 100;
    const nssfEmployeeRate = Number(settings.nssf_employee_rate ?? 0) / 100;
    const nssfEmployerRate = Number(settings.nssf_employer_rate ?? 0) / 100;

    // Check period exists and is draft
    const periodResult = await db.query(
      `SELECT *
       FROM payroll_periods
       WHERE id = $1
         AND company_id = $2
       LIMIT 1`,
      [periodId, companyId]
    );
    const period = periodResult.rows[0];

    if (!period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    if (period.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only generate payslips for draft periods' },
        { status: 400 }
      );
    }

    // Delete existing payslips if any
    await db.query('DELETE FROM payroll_payslips WHERE payroll_period_id = $1', [periodId]);

    // Get all active employees
    const employeesResult = await db.query(
      `SELECT *
       FROM employees
       WHERE company_id = $1
         AND COALESCE(is_active, true) = true`,
      [companyId]
    );
    const employees = employeesResult.rows;

    if (!employees || employees.length === 0) {
      return NextResponse.json(
        { error: 'No active employees found' },
        { status: 400 }
      );
    }

    // Read per-employee days from request body
    let employee_days: Record<string, number> = {};
    try {
      const body = await request.json().catch(() => ({}));
      employee_days = body.employee_days || {};
    } catch {}

    // Working days divisor: use period's working_days if set, else calendar days in period
    const start = new Date(period.start_date);
    const end = new Date(period.end_date);
    const calendarDaysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const workingDaysInPeriod: number = period.working_days ?? calendarDaysInPeriod;

    // Generate payslips for each employee
    const payslips = employees.map((employee: any) => {
      // Days this employee actually worked (defaults to full working days in period)
      const daysWorked: number = employee_days[employee.id] ?? workingDaysInPeriod;

      // Daily rate: use explicit daily_rate if set, otherwise derive from monthly salary
      const monthlySalary = employee.basic_salary || employee.salary || 0;
      const dailyRate: number = employee.daily_rate
        ? Number(employee.daily_rate)
        : monthlySalary / workingDaysInPeriod;

      const basicSalary = dailyRate * daysWorked;

      // Allowances prorated by days worked / working days
      const housingAllowance = employee.housing_allowance || 0;
      const transportAllowance = employee.transport_allowance || 0;
      const otherAllowances = employee.other_allowances || 0;
      const prorateRatio = daysWorked / workingDaysInPeriod;

      const totalAllowances = (housingAllowance + transportAllowance + otherAllowances) * prorateRatio;
      
      // Calculate gross salary
      const grossSalary = basicSalary + totalAllowances;
      
      // Calculate deductions using company-configured rates
      const taxDeduction = grossSalary * incomeTaxRate;
      const nhifDeduction = 0; // Not used — kept for DB compatibility
      const nssfDeduction = grossSalary * nssfEmployeeRate;
      const nssfEmployerDeduction = grossSalary * nssfEmployerRate;
      
      // Other deductions
      const loanDeduction = employee.loan_deduction || 0;
      const advanceDeduction = employee.advance_deduction || 0;
      
      const totalDeductions = taxDeduction + nhifDeduction + nssfDeduction + loanDeduction + advanceDeduction;
      
      // Calculate net salary
      const netSalary = grossSalary - totalDeductions;
      
      return {
        payroll_period_id: periodId,
        employee_id: employee.id,
        basic_salary: basicSalary,
        allowances: totalAllowances,
        housing_allowance: housingAllowance * prorateRatio,
        transport_allowance: transportAllowance * prorateRatio,
        other_allowances: otherAllowances * prorateRatio,
        gross_salary: grossSalary,
        deductions: totalDeductions,
        tax_deduction: taxDeduction,
        nhif_deduction: nhifDeduction,
        nssf_deduction: nssfDeduction,
        nssf_employee: nssfDeduction,
        nssf_employer: nssfEmployerDeduction,
        loan_deduction: loanDeduction,
        advance_deduction: advanceDeduction,
        net_salary: netSalary,
        days_worked: daysWorked,
        status: 'pending',
        created_by: user.id,
      };
    });

    const insertedPayslips: any[] = [];
    for (const p of payslips) {
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
          p.payroll_period_id,
          p.employee_id,
          p.basic_salary,
          p.allowances,
          p.housing_allowance,
          p.transport_allowance,
          p.other_allowances,
          p.gross_salary,
          p.deductions,
          p.tax_deduction,
          p.nhif_deduction,
          p.nssf_deduction,
          p.nssf_employee,
          p.nssf_employer,
          p.loan_deduction,
          p.advance_deduction,
          p.net_salary,
          p.days_worked,
          p.status,
          p.created_by,
        ]
      );
      insertedPayslips.push(insertResult.rows[0]);
    }

    // Update period totals
    const totalGross = payslips.reduce((sum: number, p: any) => sum + p.gross_salary, 0);
    const totalDeductions = payslips.reduce((sum: number, p: any) => sum + p.deductions, 0);
    const totalNet = payslips.reduce((sum: number, p: any) => sum + p.net_salary, 0);

    await db.query(
      `UPDATE payroll_periods
       SET total_gross = $2,
           total_deductions = $3,
           total_net = $4,
           employee_count = $5,
           updated_at = NOW()
       WHERE id = $1`,
      [periodId, totalGross, totalDeductions, totalNet, payslips.length]
    );

    return NextResponse.json({
      message: 'Payslips generated successfully',
      count: insertedPayslips.length,
      payslips: insertedPayslips,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
