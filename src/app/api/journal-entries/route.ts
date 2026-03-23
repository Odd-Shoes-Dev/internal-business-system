import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validatePeriodLock } from '@/lib/accounting/period-lock';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Multi-tenant: Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Multi-tenant: Get and verify company_id
    const companyId = searchParams.get('company_id');
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Multi-tenant: Verify user has access to this company
    const { data: membership } = await supabase
      .from('user_companies')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
    }

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const postedOnly = searchParams.get('postedOnly') === 'true';

    let query = supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_lines(
          id,
          account_id,
          debit,
          credit,
          description,
          account:accounts(code, name)
        )
      `)
      .eq('company_id', companyId)
      .order('entry_date', { ascending: false })
      .order('entry_number', { ascending: false });

    if (startDate) {
      query = query.gte('entry_date', startDate);
    }

    if (endDate) {
      query = query.lte('entry_date', endDate);
    }

    if (postedOnly) {
      query = query.eq('status', 'posted');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching journal entries:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to flatten account info
    const transformedData = data?.map((entry) => ({
      ...entry,
      lines: entry.lines?.map((line: any) => ({
        id: line.id,
        account_code: line.account?.code || '',
        account_name: line.account?.name || '',
        debit_amount: line.debit || 0,
        credit_amount: line.credit || 0,
        description: line.description,
      })),
    }));

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error in journal entries GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Multi-tenant: Validate and verify company_id
    if (!body.company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('user_companies')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', body.company_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
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
    const periodError = await validatePeriodLock(supabase, entry_date, body.company_id);
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
    const { data: lastEntry } = await supabase
      .from('journal_entries')
      .select('entry_number')
      .eq('company_id', body.company_id)
      .like('entry_number', `JE-${year}-%`)
      .order('entry_number', { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    if (lastEntry?.entry_number) {
      const match = lastEntry.entry_number.match(/JE-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const entryNumber = `JE-${year}-${nextNumber.toString().padStart(4, '0')}`;

    // Create journal entry
    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert([
        {
          company_id: body.company_id,
          entry_number: entryNumber,
          entry_date,
          description,
          memo: reference,
          source_module: source || 'manual',
          source_document_id: source_id,
          status: is_posted ? 'posted' : 'draft',
        },
      ])
      .select()
      .single();

    if (entryError) {
      console.error('Error creating journal entry:', entryError);
      return NextResponse.json({ error: entryError.message }, { status: 500 });
    }

    // Create journal entry lines
    const lineInserts = lines.map((line: any, index: number) => ({
      journal_entry_id: entry.id,
      line_number: index + 1,
      account_id: line.account_id,
      debit: line.debit_amount || 0,
      credit: line.credit_amount || 0,
      description: line.description || '',
    }));

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(lineInserts);

    if (linesError) {
      // Rollback - delete the entry
      await supabase.from('journal_entries').delete().eq('id', entry.id);
      console.error('Error creating journal entry lines:', linesError);
      return NextResponse.json({ error: linesError.message }, { status: 500 });
    }

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
