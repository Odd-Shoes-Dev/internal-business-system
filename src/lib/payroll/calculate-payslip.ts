import { convertCurrency } from '@/lib/exchange-rates';

// Uganda URA PAYE monthly bracket calculation
export function calculateUgandaPAYE(monthlyGross: number): number {
  if (monthlyGross <= 235000) return 0;
  if (monthlyGross <= 335000) return (monthlyGross - 235000) * 0.10;
  if (monthlyGross <= 410000) return 10000 + (monthlyGross - 335000) * 0.20;
  if (monthlyGross <= 10000000) return 25000 + (monthlyGross - 410000) * 0.30;
  return 25000 + (10000000 - 410000) * 0.30 + (monthlyGross - 10000000) * 0.40;
}

export interface PayslipCalculationInput {
  employee: any;
  daysWorked: number;
  workingDaysInPeriod: number;
  companyCurrency: string;
  ratesMap: Record<string, number>;
  nssfEmployeeRate: number;
  nssfEmployerRate: number;
  isSubjectToPaye: boolean;
  isSubjectToNssf: boolean;
}

export function calculatePayslip(input: PayslipCalculationInput) {
  const {
    employee,
    daysWorked,
    workingDaysInPeriod,
    companyCurrency,
    ratesMap,
    nssfEmployeeRate,
    nssfEmployerRate,
    isSubjectToPaye,
    isSubjectToNssf,
  } = input;

  // Convert employee salary figures to the company's default currency
  // before running any payroll math, so mismatched currencies don't
  // silently produce wrong numbers.
  const employeeCurrency = employee.salary_currency || companyCurrency;
  const toCompanyCurrency = (value: number) =>
    convertCurrency(value, employeeCurrency, companyCurrency, ratesMap);

  // Daily rate: use explicit daily_rate if set, otherwise derive from monthly salary
  const monthlySalary = toCompanyCurrency(Number(employee.basic_salary || employee.salary || 0));
  const dailyRate: number = employee.daily_rate
    ? toCompanyCurrency(Number(employee.daily_rate))
    : monthlySalary / workingDaysInPeriod;

  const basicSalary = dailyRate * daysWorked;

  // Allowances prorated by days worked / working days
  const housingAllowance = toCompanyCurrency(Number(employee.housing_allowance || 0));
  const transportAllowance = toCompanyCurrency(Number(employee.transport_allowance || 0));
  const otherAllowances = toCompanyCurrency(Number(employee.other_allowances || 0));
  const prorateRatio = daysWorked / workingDaysInPeriod;

  const totalAllowances = (housingAllowance + transportAllowance + otherAllowances) * prorateRatio;

  // Calculate gross salary
  const grossSalary = basicSalary + totalAllowances;

  // Calculate PAYE using Uganda URA progressive brackets.
  // The brackets are legally defined in UGX, so convert gross salary to UGX
  // for the lookup regardless of the company's display currency, then
  // convert the resulting tax back.
  let taxDeduction = 0;
  if (isSubjectToPaye) {
    const grossSalaryUGX = convertCurrency(grossSalary, companyCurrency, 'UGX', ratesMap);
    const taxDeductionUGX = calculateUgandaPAYE(grossSalaryUGX);
    taxDeduction = convertCurrency(taxDeductionUGX, 'UGX', companyCurrency, ratesMap);
  }
  const nhifDeduction = 0; // Not used — kept for DB compatibility
  const nssfDeduction = isSubjectToNssf ? grossSalary * nssfEmployeeRate : 0;
  const nssfEmployerDeduction = isSubjectToNssf ? grossSalary * nssfEmployerRate : 0;

  // Other deductions
  const loanDeduction = toCompanyCurrency(Number(employee.loan_deduction || 0));
  const advanceDeduction = toCompanyCurrency(Number(employee.advance_deduction || 0));

  const totalDeductions = taxDeduction + nhifDeduction + nssfDeduction + loanDeduction + advanceDeduction;

  // Calculate net salary
  const netSalary = grossSalary - totalDeductions;

  return {
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
  };
}
