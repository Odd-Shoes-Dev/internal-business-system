import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/vendors/[id]
export async function GET(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const supabase = await createClient();

    const { data, error} = await supabase
      .from('vendors')
      .select('*, accounts:default_expense_account_id (id, name, code)')
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Get recent bills
    const { data: bills } = await supabase
      .from('bills')
      .select('id, bill_number, bill_date, total, amount_paid, status')
      .eq('vendor_id', params.id)
      .order('bill_date', { ascending: false })
      .limit(10);

    return NextResponse.json({
      data: {
        ...data,
        recent_bills: bills || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/vendors/[id]
export async function PATCH(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: existing, error: fetchError } = await supabase
      .from('vendors')
      .select('id')
      .eq('id', params.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('vendors')
      .update(body)
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

// DELETE /api/vendors/[id]
export async function DELETE(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const supabase = await createClient();

    // Check for existing bills
    const { count } = await supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', params.id);

    if (count && count > 0) {
      const { data, error } = await supabase
        .from('vendors')
        .update({ is_active: false })
        .eq('id', params.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        data,
        message: 'Vendor deactivated (has existing bills)',
      });
    }

    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Vendor deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
