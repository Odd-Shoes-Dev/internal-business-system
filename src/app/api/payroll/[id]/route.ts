import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/payroll/[id] - Update payroll period (including status changes and GL posting)
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

    // Get current payroll period
    const periodResult = await db.query(
      'SELECT * FROM payroll_periods WHERE id = $1 LIMIT 1',
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

    const payslipsResult = await db.query(
      'SELECT * FROM payroll_payslips WHERE payroll_period_id = $1',
      [id]
    );
    const payslips = payslipsResult.rows;

    // Check if status is changing to 'paid' - this requires GL posting
    if (body.status === 'paid' && period.status !== 'paid') {
      // Verify we have payslips
      if (!payslips || payslips.length === 0) {
        return NextResponse.json(
          { error: 'Cannot mark payroll as paid without payslips' },
          { status: 400 }
        );
      }

      // Check if accounts exist for GL posting
      const accountsResult = await db.query(
        `SELECT id, code
         FROM accounts
         WHERE code = ANY($1)
           AND (company_id = $2 OR company_id IS NULL)
         ORDER BY (company_id = $2) DESC`,
        [['5100', '5120', '2200', '2210'], period.company_id]
      );

      const accountMap = new Map<string, string>();
      for (const row of accountsResult.rows as any[]) {
        if (!accountMap.has(row.code)) {
          accountMap.set(row.code, row.id);
        }
      }

      const salaryExpenseAccountId = accountMap.get('5100');
      const nssfExpenseAccountId = accountMap.get('5120');
      const payePayableAccountId = accountMap.get('2200');
      const nssfPayableAccountId = accountMap.get('2210');

      const bankAccountResult = await db.query(
        `SELECT id, name, gl_account_id
         FROM bank_accounts
         WHERE company_id = $1
           AND is_primary = true
         LIMIT 1`,
        [period.company_id]
      );
      const bankAccount = bankAccountResult.rows[0];

      if (!salaryExpenseAccountId || !nssfExpenseAccountId || !payePayableAccountId || !nssfPayableAccountId) {
        return NextResponse.json({
          error: 'Required GL accounts not found. Please ensure accounts 5100, 5120, 2200, 2210 exist in chart of accounts.',
        }, { status: 400 });
      }

      if (!bankAccount || !bankAccount.gl_account_id) {
        return NextResponse.json({
          error: 'Primary bank account not configured or not linked to GL account',
        }, { status: 400 });
      }

      // Calculate totals from payslips
      const totalGross = Number(period.total_gross || 0);
      const totalNet = Number(period.total_net || 0);
      const totalPaye = Number(period.total_paye || 0);
      const totalNssfEmployee = payslips.reduce((sum: number, p: any) => sum + Number(p.nssf_employee || 0), 0);
      const totalNssfEmployer = payslips.reduce((sum: number, p: any) => sum + Number(p.nssf_employer || 0), 0);

      // Create journal lines
      const journalLines = [
        // 1. Debit Salary Expense (gross salary)
        {
          account_id: salaryExpenseAccountId,
          debit: totalGross,
          credit: 0,
          description: `Salary expense - ${period.period_name}`,
        },
        // 2. Debit NSSF Employer Expense (10% employer contribution)
        {
          account_id: nssfExpenseAccountId,
          debit: totalNssfEmployer,
          credit: 0,
          description: `NSSF employer contribution - ${period.period_name}`,
        },
        // 3. Credit Bank Account (net pay to employees)
        {
          account_id: bankAccount.gl_account_id,
          debit: 0,
          credit: totalNet,
          description: `Net salary payment - ${period.period_name}`,
        },
        // 4. Credit PAYE Payable (tax withholding)
        {
          account_id: payePayableAccountId,
          debit: 0,
          credit: totalPaye,
          description: `PAYE withholding - ${period.period_name}`,
        },
        // 5. Credit NSSF Payable (employee + employer contributions)
        {
          account_id: nssfPayableAccountId,
          debit: 0,
          credit: totalNssfEmployee + totalNssfEmployer,
          description: `NSSF payable (employee + employer) - ${period.period_name}`,
        },
      ];

      const totalDebits = journalLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
      const totalCredits = journalLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        return NextResponse.json(
          { error: `Journal entry not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}` },
          { status: 400 }
        );
      }

      const result = await db.transaction(async (tx) => {
        const entryNumberResult = await tx.query('SELECT generate_journal_entry_number() AS entry_number');
        const entryNumber = entryNumberResult.rows[0]?.entry_number;
        if (!entryNumber) {
          throw new Error('Failed to create journal entry number');
        }

        const journalEntryResult = await tx.query(
          `INSERT INTO journal_entries (
             company_id, entry_number, entry_date, description, reference,
             status, source_module, source_document_id, created_by, posted_by, posted_at
           ) VALUES (
             $1, $2, $3::date, $4, $5,
             'posted', 'payroll', $6, $7, $7, NOW()
           )
           RETURNING *`,
          [
            period.company_id,
            entryNumber,
            period.payment_date,
            `Payroll payment for ${period.period_name}`,
            `PAYROLL-${String(period.id).substring(0, 8)}`,
            period.id,
            user.id,
          ]
        );

        const journalEntry = journalEntryResult.rows[0];

        let lineNumber = 1;
        for (const line of journalLines) {
          await tx.query(
            `INSERT INTO journal_lines (
               company_id, journal_entry_id, line_number, account_id, debit, credit, description
             ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              period.company_id,
              journalEntry.id,
              lineNumber,
              line.account_id,
              Number(line.debit || 0),
              Number(line.credit || 0),
              line.description,
            ]
          );
          lineNumber += 1;
        }

        const updatedPeriodResult = await tx.query(
          `UPDATE payroll_periods
           SET status = 'paid',
               journal_entry_id = $2,
               approved_by = $3,
               approved_at = NOW(),
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [id, journalEntry.id, user.id]
        );

        return {
          journalEntry,
          updatedPeriod: updatedPeriodResult.rows[0],
        };
      });

      const updatedPeriod = result.updatedPeriod;
      const journalEntry = result.journalEntry;

      return NextResponse.json({
        data: updatedPeriod,
        journal_entry: journalEntry,
        message: 'Payroll marked as paid and posted to general ledger',
      }, { status: 200 });
    }

    // For other status changes or updates
    const updateData: any = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    if (body.status === 'approved') {
      updateData.approved_by = user.id;
      updateData.approved_at = new Date().toISOString();
    }

    const disallowed = new Set(['id', 'company_id', 'created_by', 'created_at']);
    const setParts: string[] = [];
    const values: any[] = [id];

    for (const [key, value] of Object.entries(updateData)) {
      if (disallowed.has(key)) {
        continue;
      }
      values.push(value);
      setParts.push(`${key} = $${values.length}`);
    }

    if (setParts.length === 0) {
      const dataResult = await db.query('SELECT * FROM payroll_periods WHERE id = $1 LIMIT 1', [id]);
      return NextResponse.json({ data: dataResult.rows[0] }, { status: 200 });
    }

    const dataResult = await db.query(
      `UPDATE payroll_periods
       SET ${setParts.join(', ')}
       WHERE id = $1
       RETURNING *`,
      values
    );
    const data = dataResult.rows[0];

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
