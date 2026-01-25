import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bank-accounts/[id] - Get single bank account
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await context.params;

    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/bank-accounts/[id] - Update bank account
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await context.params;
    const body = await request.json();

    // Check if bank account exists
    const { data: existing, error: existingError } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('id', params.id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    // If this is being set as primary, unset other primary accounts
    if (body.is_primary) {
      await supabase
        .from('bank_accounts')
        .update({ is_primary: false })
        .eq('is_primary', true)
        .neq('id', params.id);
    }

    const { data, error } = await supabase
      .from('bank_accounts')
      .update({
        name: body.name,
        bank_name: body.bank_name,
        account_number_encrypted: null, // Would need encryption in production
        routing_number: body.routing_number || null,
        account_type: body.account_type,
        currency: body.currency,
        is_primary: body.is_primary,
        is_active: body.is_active,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bank-accounts/[id] - Delete or deactivate bank account
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await context.params;

    // Check if account has transactions
    const { data: transactions, error: transError } = await supabase
      .from('bank_transactions')
      .select('id')
      .eq('bank_account_id', params.id)
      .limit(1);

    if (transError) {
      return NextResponse.json({ error: transError.message }, { status: 400 });
    }

    // If has transactions, soft delete (deactivate)
    if (transactions && transactions.length > 0) {
      const { data, error } = await supabase
        .from('bank_accounts')
        .update({ is_active: false })
        .eq('id', params.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ 
        data, 
        message: 'Bank account deactivated (has transactions)' 
      });
    }

    // Otherwise, hard delete
    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      message: 'Bank account deleted successfully' 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
