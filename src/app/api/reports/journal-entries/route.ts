import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const status = searchParams.get('status') || 'all';
    const type = searchParams.get('type') || 'all';

    // Fetch journal entries from database
    let query = supabase
      .from('journal_entries')
      .select(`
        id,
        entry_number,
        entry_date,
        description,
        memo,
        source_module,
        status,
        created_at,
        created_by,
        lines:journal_lines(
          id,
          line_number,
          account_id,
          debit,
          credit,
          description,
          account:accounts(
            code,
            name
          )
        )
      `)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: false })
      .order('entry_number', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status.toLowerCase());
    }

    const { data: journalEntriesData, error } = await query;

    if (error) {
      console.error('Error fetching journal entries:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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
      const totalDebit = entry.lines?.reduce((sum: number, line: any) => sum + (parseFloat(line.debit) || 0), 0) || 0;
      const totalCredit = entry.lines?.reduce((sum: number, line: any) => sum + (parseFloat(line.credit) || 0), 0) || 0;

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
        lineItems: (entry.lines || []).map((line: any) => ({
          id: line.id,
          accountCode: line.account?.code || '',
          accountName: line.account?.name || '',
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
