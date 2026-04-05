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

    // Calculate number of days in the period
    const start = new Date(period.period_start);
    const end = new Date(period.period_end);
    const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysInMonth = 30; // Standard month for calculation

    // Generate payslips for each employee
    const payslips = employees.map((employee: any) => {
      const monthlySalary = employee.salary || 0;
      
      // Calculate basic salary (prorated if partial period)
      const basicSalary = (monthlySalary * daysInPeriod) / daysInMonth;
      
      // Calculate allowances (example: housing, transport, etc.)
      const housingAllowance = employee.housing_allowance || 0;
      const transportAllowance = employee.transport_allowance || 0;
      const otherAllowances = employee.other_allowances || 0;
      
      const totalAllowances = (housingAllowance + transportAllowance + otherAllowances) * daysInPeriod / daysInMonth;
      
      // Calculate gross salary
      const grossSalary = basicSalary + totalAllowances;
      
      // Calculate deductions
      // Tax (simplified - should be based on tax brackets)
      const taxRate = 0.15; // 15% flat tax (example)
      const taxDeduction = grossSalary * taxRate;
      
      // NHIF (National Health Insurance Fund - example rates)
      const nhifDeduction = grossSalary * 0.025; // 2.5%
      
      // NSSF (National Social Security Fund - example rates)
      const nssfDeduction = Math.min(grossSalary * 0.06, 500); // 6% up to max
      
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
        housing_allowance: (housingAllowance * daysInPeriod) / daysInMonth,
        transport_allowance: (transportAllowance * daysInPeriod) / daysInMonth,
        other_allowances: (otherAllowances * daysInPeriod) / daysInMonth,
        gross_salary: grossSalary,
        deductions: totalDeductions,
        tax_deduction: taxDeduction,
        nhif_deduction: nhifDeduction,
        nssf_deduction: nssfDeduction,
        loan_deduction: loanDeduction,
        advance_deduction: advanceDeduction,
        net_salary: netSalary,
        days_worked: daysInPeriod,
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
           nssf_deduction, loan_deduction, advance_deduction,
           net_salary, days_worked, status, created_by
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7,
           $8, $9, $10, $11,
           $12, $13, $14,
           $15, $16, $17, $18
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
