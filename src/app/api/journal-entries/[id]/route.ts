import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/journal-entries/[id] - Get single journal entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    // Fetch journal entry with lines
    const entryResult = await db.query(
      'SELECT * FROM journal_entries WHERE id = $1 LIMIT 1',
      [id]
    );
    const entry = entryResult.rows[0];

    if (!entry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, entry.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const linesResult = await db.query(
      `SELECT jl.*, a.code AS account_code, a.name AS account_name
       FROM journal_lines jl
       LEFT JOIN accounts a ON a.id = jl.account_id
       WHERE jl.journal_entry_id = $1
       ORDER BY jl.line_number ASC`,
      [id]
    );

    // Transform the response
    const transformedEntry = {
      id: entry.id,
      entry_number: entry.entry_number,
      entry_date: entry.entry_date,
      description: entry.description,
      reference: entry.memo || '',
      source: entry.source_module,
      source_id: entry.source_document_id,
      status: entry.status,
      is_posted: entry.status === 'posted',
      lines: linesResult.rows.map((line: any) => ({
        id: line.id,
        account_id: line.account_id,
        account_code: line.account_code,
        account_name: line.account_name,
        debit_amount: line.debit,
        credit_amount: line.credit,
        description: line.description,
        line_number: line.line_number,
      })),
    };

    return NextResponse.json(transformedEntry);
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal entry' },
      { status: 500 }
    );
  }
}

// PATCH /api/journal-entries/[id] - Update or void journal entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const { action, ...updateData } = body;

    // Check if entry exists and belongs to user
    const existingEntryResult = await db.query(
      'SELECT id, status, company_id FROM journal_entries WHERE id = $1 LIMIT 1',
      [id]
    );
    const existingEntry = existingEntryResult.rows[0];

    if (!existingEntry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existingEntry.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Handle void action
    if (action === 'void') {
      if (existingEntry.status !== 'posted') {
        return NextResponse.json(
          { error: 'Only posted entries can be voided' },
          { status: 400 }
        );
      }

      await db.query(
        `UPDATE journal_entries
         SET status = 'void', updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      return NextResponse.json({ message: 'Journal entry voided successfully' });
    }

    // Handle edit action - only drafts can be edited (unless just posting)
    if (existingEntry.status !== 'draft' && action !== 'void') {
      // Allow changing from draft to posted, but not editing posted entries
      if (!(existingEntry.status === 'draft' && updateData.is_posted === true)) {
        return NextResponse.json(
          { error: 'Only draft entries can be edited' },
          { status: 400 }
        );
      }
    }

    // Validate that debits equal credits if lines are provided
    if (updateData.lines) {
      const totalDebits = updateData.lines.reduce(
        (sum: number, line: any) => sum + (line.debit_amount || 0),
        0
      );
      const totalCredits = updateData.lines.reduce(
        (sum: number, line: any) => sum + (line.credit_amount || 0),
        0
      );

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        return NextResponse.json(
          { error: 'Debits must equal credits' },
          { status: 400 }
        );
      }
    }

    // Update journal entry header
    const entryUpdate: any = {};
    if (updateData.entry_date) entryUpdate.entry_date = updateData.entry_date;
    if (updateData.description) entryUpdate.description = updateData.description;
    if (updateData.reference) entryUpdate.memo = updateData.reference;
    if (updateData.source) entryUpdate.source_module = updateData.source;
    if (updateData.is_posted !== undefined) {
      entryUpdate.status = updateData.is_posted ? 'posted' : 'draft';
    }

    if (Object.keys(entryUpdate).length > 0) {
      const setParts: string[] = [];
      const values: any[] = [id];
      for (const [key, value] of Object.entries(entryUpdate)) {
        values.push(value);
        setParts.push(`${key} = $${values.length}`);
      }
      await db.query(
        `UPDATE journal_entries
         SET ${setParts.join(', ')}, updated_at = NOW()
         WHERE id = $1`,
        values
      );
    }

    // Update journal lines if provided
    if (updateData.lines) {
      await db.transaction(async (tx) => {
        await tx.query('DELETE FROM journal_lines WHERE journal_entry_id = $1', [id]);

        let lineNumber = 1;
        for (const line of updateData.lines) {
          await tx.query(
            `INSERT INTO journal_lines (
               company_id, journal_entry_id, account_id, debit, credit, description, line_number
             ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              existingEntry.company_id,
              id,
              line.account_id,
              Number(line.debit_amount || 0),
              Number(line.credit_amount || 0),
              line.description || '',
              lineNumber,
            ]
          );
          lineNumber += 1;
        }
      });
    }

    return NextResponse.json({ message: 'Journal entry updated successfully' });
  } catch (error) {
    console.error('Error updating journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to update journal entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/journal-entries/[id] - Delete draft journal entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    // Check if entry exists and is a draft
    const existingEntryResult = await db.query(
      'SELECT id, status, company_id FROM journal_entries WHERE id = $1 LIMIT 1',
      [id]
    );
    const existingEntry = existingEntryResult.rows[0];

    if (!existingEntry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existingEntry.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (existingEntry.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft entries can be deleted. Posted entries must be voided.' },
        { status: 400 }
      );
    }

    await db.transaction(async (tx) => {
      await tx.query('DELETE FROM journal_lines WHERE journal_entry_id = $1', [id]);
      await tx.query('DELETE FROM journal_entries WHERE id = $1', [id]);
    });

    return NextResponse.json({ message: 'Journal entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete journal entry' },
      { status: 500 }
    );
  }
}
