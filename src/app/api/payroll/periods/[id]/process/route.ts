import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/payroll/periods/[id]/process - Process payroll (create journal entries)
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

    // Check period exists and is draft
    const periodResult = await db.query(
      'SELECT * FROM payroll_periods WHERE id = $1 LIMIT 1',
      [periodId]
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
        { error: 'Can only process draft payroll periods' },
        { status: 400 }
      );
    }

    const payslipsResult = await db.query(
      'SELECT * FROM payroll_payslips WHERE payroll_period_id = $1',
      [periodId]
    );
    const payslips = payslipsResult.rows;

    if (!payslips || payslips.length === 0) {
      return NextResponse.json(
        { error: 'No payslips found. Generate payslips first.' },
        { status: 400 }
      );
    }

    // Calculate totals
    const totalGross = payslips.reduce((sum: number, p: any) => sum + Number(p.gross_salary || 0), 0);
    const totalTax = payslips.reduce((sum: number, p: any) => sum + Number(p.tax_deduction || 0), 0);
    const totalNHIF = payslips.reduce((sum: number, p: any) => sum + Number(p.nhif_deduction || 0), 0);
    const totalNSSF = payslips.reduce((sum: number, p: any) => sum + Number(p.nssf_deduction || 0), 0);
    const totalNet = payslips.reduce((sum: number, p: any) => sum + Number(p.net_salary || 0), 0);

    // Get account IDs for journal entry
    const accountsResult = await db.query(
      `SELECT id, code, company_id
       FROM accounts
       WHERE code = ANY($1)
         AND (company_id = $2 OR company_id IS NULL)
       ORDER BY (company_id = $2) DESC`,
      [['6100', '2300', '2310', '2320', '2330'], period.company_id]
    );
    const accounts = accountsResult.rows;

    const accountMap = new Map(accounts?.map((a: any) => [a.code, a.id]));

    const salaryExpenseId = accountMap.get('6100'); // Salary & Wages Expense
    const payrollPayableId = accountMap.get('2300'); // Payroll Payable
    const taxPayableId = accountMap.get('2310'); // Tax Payable
    const nhifPayableId = accountMap.get('2320'); // NHIF Payable
    const nssfPayableId = accountMap.get('2330'); // NSSF Payable

    if (!salaryExpenseId || !payrollPayableId || !taxPayableId || !nhifPayableId || !nssfPayableId) {
      return NextResponse.json(
        { error: 'Required payroll accounts not found. Please set up accounts with codes: 6100, 2300, 2310, 2320, 2330' },
        { status: 400 }
      );
    }

    // Create journal entry
    // Debit: Salary Expense (total gross)
    // Credit: Payroll Payable (net pay)
    // Credit: Tax Payable (tax deductions)
    // Credit: NHIF Payable (NHIF deductions)
    // Credit: NSSF Payable (NSSF deductions)

    const lines = [
      {
        account_id: salaryExpenseId,
        debit: totalGross,
        credit: 0,
        description: `Payroll expense for period ${period.period_start} to ${period.period_end}`,
      },
      {
        account_id: payrollPayableId,
        debit: 0,
        credit: totalNet,
        description: `Net payroll payable for period ${period.period_start} to ${period.period_end}`,
      },
    ];

    if (totalTax > 0) {
      lines.push({
        account_id: taxPayableId,
        debit: 0,
        credit: totalTax,
        description: `Tax payable for period ${period.period_start} to ${period.period_end}`,
      });
    }

    if (totalNHIF > 0) {
      lines.push({
        account_id: nhifPayableId,
        debit: 0,
        credit: totalNHIF,
        description: `NHIF payable for period ${period.period_start} to ${period.period_end}`,
      });
    }

    if (totalNSSF > 0) {
      lines.push({
        account_id: nssfPayableId,
        debit: 0,
        credit: totalNSSF,
        description: `NSSF payable for period ${period.period_start} to ${period.period_end}`,
      });
    }

    const totalDebits = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const totalCredits = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json(
        { error: `Journal entry not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}` },
        { status: 400 }
      );
    }

    const journalEntryId = await db.transaction(async (tx) => {
      const entryNumberResult = await tx.query('SELECT generate_journal_entry_number() AS entry_number');
      const entryNumber = entryNumberResult.rows[0]?.entry_number;
      if (!entryNumber) {
        throw new Error('Failed to generate journal entry number');
      }

      const journalEntryResult = await tx.query(
        `INSERT INTO journal_entries (
           company_id, entry_number, entry_date, description,
           source_module, source_document_id, status,
           created_by, posted_by, posted_at
         ) VALUES (
           $1, $2, $3::date, $4,
           'payroll', $5, 'posted',
           $6, $6, NOW()
         )
         RETURNING id`,
        [
          period.company_id,
          entryNumber,
          period.payment_date,
          `Payroll for period ${period.period_start} to ${period.period_end}`,
          periodId,
          user.id,
        ]
      );

      const journalEntryId = journalEntryResult.rows[0]?.id;
      if (!journalEntryId) {
        throw new Error('Failed to create payroll journal entry');
      }

      let lineNumber = 1;
      for (const line of lines) {
        await tx.query(
          `INSERT INTO journal_lines (
             company_id, journal_entry_id, line_number, account_id, debit, credit, description
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            period.company_id,
            journalEntryId,
            lineNumber,
            line.account_id,
            Number(line.debit || 0),
            Number(line.credit || 0),
            line.description,
          ]
        );
        lineNumber += 1;
      }

      return journalEntryId;
    });

    // Update period status and journal entry reference
    const updatedPeriodResult = await db.query(
      `UPDATE payroll_periods
       SET status = 'processed',
           journal_entry_id = $2,
           processed_by = $3,
           processed_at = NOW(),
           total_gross = $4,
           total_deductions = $5,
           total_net = $6,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [periodId, journalEntryId, user.id, totalGross, totalTax + totalNHIF + totalNSSF, totalNet]
    );
    const updatedPeriod = updatedPeriodResult.rows[0];

    // Update all payslips to processed
    await db.query(
      `UPDATE payroll_payslips
       SET status = 'processed'
       WHERE payroll_period_id = $1`,
      [periodId]
    );

    return NextResponse.json({
      message: 'Payroll processed successfully',
      period: updatedPeriod,
      journal_entry_id: journalEntryId,
      totals: {
        gross: totalGross,
        tax: totalTax,
        nhif: totalNHIF,
        nssf: totalNSSF,
        net: totalNet,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
