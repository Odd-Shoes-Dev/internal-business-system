import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface TaxDeduction {
  category: string;
  description: string;
  amount: number;
  deductible: boolean;
}

interface QuarterlyTax {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  period: string;
  estimatedPayment: number;
  actualPayment: number;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

interface TaxSummaryData {
  reportPeriod: {
    taxYear: number;
    startDate: string;
    endDate: string;
  };
  income: {
    grossRevenue: number;
    netIncome: number;
    operatingIncome: number;
    otherIncome: number;
    totalTaxableIncome: number;
  };
  deductions: {
    totalDeductions: number;
    businessExpenses: number;
    depreciation: number;
    interestExpenses: number;
    otherDeductions: number;
    itemizedDeductions: TaxDeduction[];
  };
  taxCalculations: {
    taxableIncome: number;
    federalTaxRate: number;
    federalTaxLiability: number;
    stateTaxRate: number;
    stateTaxLiability: number;
    selfEmploymentTax: number;
    totalTaxLiability: number;
    effectiveTaxRate: number;
  };
  payments: {
    quarterlyPayments: QuarterlyTax[];
    totalPaid: number;
    withheld: number;
    refundDue: number;
    balanceDue: number;
  };
  compliance: {
    filingStatus: 'Corporation' | 'Partnership' | 'LLC' | 'Sole Proprietorship';
    ein: string;
    filingDeadline: string;
    extensionFiled: boolean;
    extensionDeadline?: string;
    estimatedPenalty: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const taxYear = parseInt(searchParams.get('taxYear') || new Date().getFullYear().toString());

    // Validate tax year
    const currentYear = new Date().getFullYear();
    if (taxYear < currentYear - 10 || taxYear > currentYear + 1) {
      return NextResponse.json({ error: 'Invalid tax year' }, { status: 400 });
    }

    const startDate = `${taxYear}-01-01`;
    const endDate = `${taxYear}-12-31`;

    // Fetch invoices for revenue (paid and partial)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('total_amount, amount_paid, status, issue_date')
      .gte('issue_date', startDate)
      .lte('issue_date', endDate)
      .in('status', ['paid', 'partial']);

    // Calculate gross revenue from invoices
    const grossRevenue = (invoices || []).reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);

    // Fetch expenses for deductions
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, category, description, expense_date')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);

    // Fetch bills for additional deductions
    const { data: bills } = await supabase
      .from('bills')
      .select('total_amount, amount_paid, category, description, bill_date')
      .gte('bill_date', startDate)
      .lte('bill_date', endDate)
      .in('status', ['paid', 'partial']);

    // Fetch assets for depreciation calculation
    const { data: assets } = await supabase
      .from('assets')
      .select('purchase_price, depreciation_method, useful_life_months, accumulated_depreciation, purchase_date')
      .lte('purchase_date', endDate)
      .eq('status', 'active');

    // Calculate depreciation for the year
    const currentDate = new Date(endDate);
    const depreciation = (assets || []).reduce((sum, asset) => {
      const purchaseDate = new Date(asset.purchase_date);
      if (purchaseDate > currentDate) return sum;
      
      const monthsElapsed = Math.min(
        asset.useful_life_months || 60,
        ((currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      );
      
      const annualDepreciation = (asset.purchase_price || 0) / ((asset.useful_life_months || 60) / 12);
      const monthsInYear = Math.min(12, monthsElapsed);
      
      return sum + (annualDepreciation * (monthsInYear / 12));
    }, 0);

    // Categorize expenses and bills
    const expenseCategories: Record<string, number> = {};
    const itemizedDeductions: TaxDeduction[] = [];

    (expenses || []).forEach(exp => {
      const category = exp.category || 'Other Expenses';
      expenseCategories[category] = (expenseCategories[category] || 0) + (exp.amount || 0);
    });

    (bills || []).forEach(bill => {
      const category = bill.category || 'Vendor Payments';
      expenseCategories[category] = (expenseCategories[category] || 0) + (bill.amount_paid || 0);
    });

    // Create itemized deductions from categories
    Object.entries(expenseCategories).forEach(([category, amount]) => {
      if (amount > 0) {
        itemizedDeductions.push({
          category,
          description: `${category} expenses for ${taxYear}`,
          amount,
          deductible: true
        });
      }
    });

    // Add depreciation as a deduction
    if (depreciation > 0) {
      itemizedDeductions.push({
        category: 'Depreciation',
        description: 'Asset depreciation for the year',
        amount: depreciation,
        deductible: true
      });
    }

    // Calculate totals
    const businessExpenses = Object.values(expenseCategories).reduce((sum, val) => sum + val, 0);
    const interestExpenses = expenseCategories['Interest'] || 0;
    const otherDeductions = expenseCategories['Other Expenses'] || 0;
    const totalDeductions = businessExpenses + depreciation;

    const operatingIncome = grossRevenue - businessExpenses;
    const otherIncome = 0; // Can be expanded to include interest income from bank accounts
    const netIncome = operatingIncome + otherIncome;

    // Tax calculations
    const taxableIncome = Math.max(0, netIncome - depreciation);
    const federalTaxRate = 0.21; // Corporate tax rate
    const stateTaxRate = 0.063; // Massachusetts corporate tax rate
    const federalTaxLiability = taxableIncome * federalTaxRate;
    const stateTaxLiability = taxableIncome * stateTaxRate;
    const selfEmploymentTax = netIncome * 0.153; // 15.3% SE tax rate
    const totalTaxLiability = federalTaxLiability + stateTaxLiability + selfEmploymentTax;
    const effectiveTaxRate = netIncome > 0 ? totalTaxLiability / netIncome : 0;

    // Quarterly payments (simplified - could be enhanced with actual payment records)
    const quarterlyEstimate = totalTaxLiability / 4;
    const quarterlyPayments: QuarterlyTax[] = [
      {
        quarter: 'Q1',
        period: `Jan - Mar ${taxYear}`,
        estimatedPayment: quarterlyEstimate,
        actualPayment: taxYear < currentYear ? quarterlyEstimate : 0,
        dueDate: `${taxYear}-04-15`,
        status: taxYear < currentYear ? 'Paid' : 'Pending'
      },
      {
        quarter: 'Q2',
        period: `Apr - Jun ${taxYear}`,
        estimatedPayment: quarterlyEstimate,
        actualPayment: taxYear < currentYear ? quarterlyEstimate : 0,
        dueDate: `${taxYear}-06-15`,
        status: taxYear < currentYear ? 'Paid' : 'Pending'
      },
      {
        quarter: 'Q3',
        period: `Jul - Sep ${taxYear}`,
        estimatedPayment: quarterlyEstimate,
        actualPayment: taxYear < currentYear ? quarterlyEstimate : 0,
        dueDate: `${taxYear}-09-15`,
        status: taxYear < currentYear ? 'Paid' : 'Pending'
      },
      {
        quarter: 'Q4',
        period: `Oct - Dec ${taxYear}`,
        estimatedPayment: quarterlyEstimate,
        actualPayment: taxYear < currentYear ? quarterlyEstimate : 0,
        dueDate: `${taxYear + 1}-01-15`,
        status: taxYear < currentYear ? 'Paid' : 'Pending'
      }
    ];

    const totalPaid = quarterlyPayments.reduce((sum, q) => sum + q.actualPayment, 0);
    const balanceDue = totalTaxLiability - totalPaid;

    const taxData: TaxSummaryData = {
      reportPeriod: {
        taxYear,
        startDate,
        endDate
      },
      income: {
        grossRevenue,
        netIncome,
        operatingIncome,
        otherIncome,
        totalTaxableIncome: netIncome
      },
      deductions: {
        totalDeductions,
        businessExpenses,
        depreciation,
        interestExpenses,
        otherDeductions,
        itemizedDeductions
      },
      taxCalculations: {
        taxableIncome,
        federalTaxRate,
        federalTaxLiability,
        stateTaxRate,
        stateTaxLiability,
        selfEmploymentTax,
        totalTaxLiability,
        effectiveTaxRate
      },
      payments: {
        quarterlyPayments,
        totalPaid,
        withheld: 0,
        refundDue: balanceDue < 0 ? Math.abs(balanceDue) : 0,
        balanceDue: balanceDue > 0 ? balanceDue : 0
      },
      compliance: {
        filingStatus: 'LLC',
        ein: '99-3334108',
        filingDeadline: `${taxYear + 1}-03-15`,
        extensionFiled: false,
        estimatedPenalty: balanceDue > 1000 ? balanceDue * 0.02 : 0
      }
    };

    return NextResponse.json(taxData);
  } catch (error) {
    console.error('Tax summary API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}