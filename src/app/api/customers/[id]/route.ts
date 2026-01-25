import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/customers/[id]
export async function GET(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get recent invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, total, amount_paid, status')
      .eq('customer_id', params.id)
      .order('invoice_date', { ascending: false })
      .limit(10);

    return NextResponse.json({
      data: {
        ...data,
        recent_invoices: invoices || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/customers/[id]
export async function PATCH(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Check customer exists
    const { data: existing, error: fetchError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', params.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Check email uniqueness if updating
    if (body.email) {
      const { data: emailCheck } = await supabase
        .from('customers')
        .select('id')
        .eq('email', body.email)
        .neq('id', params.id)
        .single();

      if (emailCheck) {
        return NextResponse.json(
          { error: 'A customer with this email already exists' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('customers')
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

// DELETE /api/customers/[id]
export async function DELETE(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const supabase = await createClient();

    // Check for existing invoices
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', params.id);

    if (count && count > 0) {
      // Soft delete - deactivate instead
      const { data, error } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', params.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        data,
        message: 'Customer deactivated (has existing invoices)',
      });
    }

    // Hard delete if no invoices
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Customer deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
