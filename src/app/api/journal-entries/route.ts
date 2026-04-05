import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { asQueryExecutor, validatePeriodLockWithDb } from '@/lib/accounting/provider-accounting';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);

    // Multi-tenant: Get and verify company_id
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const postedOnly = searchParams.get('postedOnly') === 'true';

    const where: string[] = ['je.company_id = $1'];
    const params: any[] = [companyId];

    if (startDate) {
      params.push(startDate);
      where.push(`je.entry_date >= $${params.length}::date`);
    }

    if (endDate) {
      params.push(endDate);
      where.push(`je.entry_date <= $${params.length}::date`);
    }

    if (postedOnly) {
      where.push(`je.status = 'posted'`);
    }

    const entriesResult = await db.query(
      `SELECT je.*
       FROM journal_entries je
       WHERE ${where.join(' AND ')}
       ORDER BY je.entry_date DESC, je.entry_number DESC`,
      params
    );

    const transformedData = [];
    for (const entry of entriesResult.rows as any[]) {
      const linesResult = await db.query(
        `SELECT jl.id,
                jl.account_id,
                jl.debit,
                jl.credit,
                jl.description,
                a.code AS account_code,
                a.name AS account_name
         FROM journal_lines jl
         LEFT JOIN accounts a ON a.id = jl.account_id
         WHERE jl.journal_entry_id = $1
         ORDER BY jl.line_number ASC`,
        [entry.id]
      );

      transformedData.push({
        ...entry,
        lines: linesResult.rows.map((line: any) => ({
          id: line.id,
          account_code: line.account_code || '',
          account_name: line.account_name || '',
          debit_amount: line.debit || 0,
          credit_amount: line.credit || 0,
          description: line.description,
        })),
      });
    }

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error in journal entries GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    // Multi-tenant: Validate and verify company_id
    if (!body.company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, body.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const {
      entry_date,
      description,
      reference,
      source,
      source_id,
      lines,
      is_posted = false,
    } = body;

    // Check if period is closed
    const periodError = await validatePeriodLockWithDb(asQueryExecutor(db), entry_date, body.company_id);
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 403 });
    }

    // Validate that debits equal credits
    const totalDebits = lines.reduce((sum: number, l: any) => sum + (l.debit_amount || 0), 0);
    const totalCredits = lines.reduce((sum: number, l: any) => sum + (l.credit_amount || 0), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json(
        { error: 'Debits must equal credits' },
        { status: 400 }
      );
    }

    // Generate entry number
    const year = new Date(entry_date).getFullYear();
    const lastEntryResult = await db.query(
      `SELECT entry_number
       FROM journal_entries
       WHERE company_id = $1
         AND entry_number LIKE $2
       ORDER BY entry_number DESC
       LIMIT 1`,
      [body.company_id, `JE-${year}-%`]
    );
    const lastEntry = lastEntryResult.rows[0];

    let nextNumber = 1;
    if (lastEntry?.entry_number) {
      const match = lastEntry.entry_number.match(/JE-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const entryNumber = `JE-${year}-${nextNumber.toString().padStart(4, '0')}`;

    const entry = await db.transaction(async (tx) => {
      const entryResult = await tx.query(
        `INSERT INTO journal_entries (
           company_id, entry_number, entry_date, description, memo,
           source_module, source_document_id, status, created_by,
           posted_by, posted_at
         ) VALUES (
           $1, $2, $3::date, $4, $5,
           $6, $7, $8, $9,
           $10, $11
         )
         RETURNING *`,
        [
          body.company_id,
          entryNumber,
          entry_date,
          description,
          reference || null,
          source || 'manual',
          source_id || null,
          is_posted ? 'posted' : 'draft',
          user.id,
          is_posted ? user.id : null,
          is_posted ? new Date().toISOString() : null,
        ]
      );

      const createdEntry = entryResult.rows[0];

      let lineNumber = 1;
      for (const line of lines) {
        await tx.query(
          `INSERT INTO journal_lines (
             company_id, journal_entry_id, line_number, account_id, debit, credit, description
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            body.company_id,
            createdEntry.id,
            lineNumber,
            line.account_id,
            Number(line.debit_amount || 0),
            Number(line.credit_amount || 0),
            line.description || '',
          ]
        );
        lineNumber += 1;
      }

      return createdEntry;
    });

    // If posted, update account balances
    if (is_posted) {
      for (const line of lines) {
        // Update account balance in chart_of_accounts
        // This would typically be done via a database trigger
      }
    }

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error in journal entries POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
