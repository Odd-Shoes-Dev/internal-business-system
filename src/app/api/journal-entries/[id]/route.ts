import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/journal-entries/[id] - Get single journal entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch journal entry with lines
    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_lines(
          *,
          account:accounts(code, name)
        )
      `)
      .eq('id', id)
      .single();

    if (entryError) {
      return NextResponse.json({ error: entryError.message }, { status: 500 });
    }

    if (!entry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

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
      lines: entry.lines?.map((line: any) => ({
        id: line.id,
        account_id: line.account_id,
        account_code: line.account.code,
        account_name: line.account.name,
        debit_amount: line.debit,
        credit_amount: line.credit,
        description: line.description,
        line_number: line.line_number,
      })) || [],
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
    const supabase = await createClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...updateData } = body;

    // Check if entry exists and belongs to user
    const { data: existingEntry, error: fetchError } = await supabase
      .from('journal_entries')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existingEntry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    // Handle void action
    if (action === 'void') {
      if (existingEntry.status !== 'posted') {
        return NextResponse.json(
          { error: 'Only posted entries can be voided' },
          { status: 400 }
        );
      }

      const { error: voidError } = await supabase
        .from('journal_entries')
        .update({ status: 'void' })
        .eq('id', id);

      if (voidError) {
        return NextResponse.json({ error: voidError.message }, { status: 500 });
      }

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
      const { error: updateError } = await supabase
        .from('journal_entries')
        .update(entryUpdate)
        .eq('id', id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    // Update journal lines if provided
    if (updateData.lines) {
      // Delete existing lines
      const { error: deleteError } = await supabase
        .from('journal_lines')
        .delete()
        .eq('journal_entry_id', id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      // Insert new lines
      const linesToInsert = updateData.lines.map((line: any, index: number) => ({
        journal_entry_id: id,
        account_id: line.account_id,
        debit: line.debit_amount || 0,
        credit: line.credit_amount || 0,
        description: line.description,
        line_number: index + 1,
      }));

      const { error: insertError } = await supabase
        .from('journal_lines')
        .insert(linesToInsert);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
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
    const supabase = await createClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if entry exists and is a draft
    const { data: existingEntry, error: fetchError } = await supabase
      .from('journal_entries')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existingEntry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    if (existingEntry.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft entries can be deleted. Posted entries must be voided.' },
        { status: 400 }
      );
    }

    // Delete journal lines first (due to foreign key constraint)
    const { error: deleteLinesError } = await supabase
      .from('journal_lines')
      .delete()
      .eq('journal_entry_id', id);

    if (deleteLinesError) {
      return NextResponse.json({ error: deleteLinesError.message }, { status: 500 });
    }

    // Delete journal entry
    const { error: deleteError } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Journal entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete journal entry' },
      { status: 500 }
    );
  }
}
