import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  reference: string;
  description: string;
  type: 'Manual' | 'System' | 'Adjustment' | 'Closing';
  status: 'Draft' | 'Posted' | 'Reversed';
  createdBy: string;
  totalDebit: number;
  totalCredit: number;
  lineItems: Array<{
    id: string;
    accountCode: string;
    accountName: string;
    description: string;
    debit: number;
    credit: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const searchParams = request.nextUrl.searchParams;
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const status = searchParams.get('status') || 'all';
    const type = searchParams.get('type') || 'all';

    const params: any[] = [companyId, startDate, endDate];
    let statusClause = '';
    if (status !== 'all') {
      params.push(status.toLowerCase());
      statusClause = ` AND je.status = $${params.length}`;
    }

    const entriesResult = await db.query(
      `SELECT je.id,
              je.entry_number,
              je.entry_date,
              je.description,
              je.memo,
              je.source_module,
              je.status,
              je.created_at,
              je.created_by
       FROM journal_entries je
       WHERE je.company_id = $1
         AND je.entry_date >= $2::date
         AND je.entry_date <= $3::date
         ${statusClause}
       ORDER BY je.entry_date DESC, je.entry_number DESC`,
      params
    );

    const journalEntriesData = entriesResult.rows;
    const entryIds = journalEntriesData.map((entry: any) => entry.id);

    let linesByEntryId = new Map<string, any[]>();
    if (entryIds.length > 0) {
      const linesResult = await db.query(
        `SELECT jl.id,
                jl.journal_entry_id,
                jl.line_number,
                jl.account_id,
                jl.debit,
                jl.credit,
                jl.description,
                a.code AS account_code,
                a.name AS account_name
         FROM journal_lines jl
         LEFT JOIN accounts a ON a.id = jl.account_id
         WHERE jl.journal_entry_id = ANY($1::uuid[])
         ORDER BY jl.line_number ASC`,
        [entryIds]
      );

      for (const line of linesResult.rows) {
        const current = linesByEntryId.get(line.journal_entry_id) || [];
        current.push(line);
        linesByEntryId.set(line.journal_entry_id, current);
      }
    }

    // Map source_module to entry type
    const getEntryType = (sourceModule: string | null): JournalEntry['type'] => {
      if (!sourceModule) return 'Manual';
      const source = sourceModule.toLowerCase();
      if (source === 'manual' || source === 'journal') return 'Manual';
      if (source === 'closing' || source === 'year-end') return 'Closing';
      if (source === 'adjustment') return 'Adjustment';
      return 'System';
    };

    // Transform to expected format
    const entries: JournalEntry[] = (journalEntriesData || []).map((entry: any) => {
      const lines = linesByEntryId.get(entry.id) || [];
      const totalDebit = lines.reduce((sum: number, line: any) => sum + (parseFloat(line.debit) || 0), 0);
      const totalCredit = lines.reduce((sum: number, line: any) => sum + (parseFloat(line.credit) || 0), 0);

      return {
        id: entry.id,
        entryNumber: entry.entry_number,
        date: entry.entry_date,
        reference: entry.memo || entry.entry_number,
        description: entry.description || '',
        type: getEntryType(entry.source_module),
        status: entry.status === 'posted' ? 'Posted' : entry.status === 'void' ? 'Reversed' : 'Draft',
        createdBy: entry.created_by || 'System',
        totalDebit,
        totalCredit,
        lineItems: lines.map((line: any) => ({
          id: line.id,
          accountCode: line.account_code || '',
          accountName: line.account_name || '',
          description: line.description || '',
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0,
        })),
      };
    });

    // Filter by type if specified
    let filteredEntries = entries;
    if (type !== 'all') {
      filteredEntries = entries.filter(entry => entry.type === type);
    }

    // Calculate summary statistics
    const summary = {
      totalEntries: filteredEntries.length,
      totalDebits: filteredEntries.reduce((sum, e) => sum + e.totalDebit, 0),
      totalCredits: filteredEntries.reduce((sum, e) => sum + e.totalCredit, 0),
      postedEntries: filteredEntries.filter(e => e.status === 'Posted').length,
      draftEntries: filteredEntries.filter(e => e.status === 'Draft').length,
      reversedEntries: filteredEntries.filter(e => e.status === 'Reversed').length,
      manualEntries: filteredEntries.filter(e => e.type === 'Manual').length,
      systemEntries: filteredEntries.filter(e => e.type === 'System').length,
      adjustmentEntries: filteredEntries.filter(e => e.type === 'Adjustment').length,
      closingEntries: filteredEntries.filter(e => e.type === 'Closing').length,
      balanceDifference: filteredEntries.reduce((sum, e) => sum + e.totalDebit, 0) - filteredEntries.reduce((sum, e) => sum + e.totalCredit, 0),
    };

    const response = {
      reportPeriod: {
        startDate,
        endDate,
      },
      summary,
      entries: filteredEntries,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Journal entries report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate journal entries report' },
      { status: 500 }
    );
  }
}

