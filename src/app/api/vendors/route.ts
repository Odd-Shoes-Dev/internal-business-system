import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/vendors - List vendors
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Multi-tenant: Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Multi-tenant: Get company_id from query params
    const companyId = searchParams.get('company_id');
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Multi-tenant: Verify user has access to this company
    const { data: membership } = await supabase
      .from('user_companies')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
    }
    
    const search = searchParams.get('search');
    const active = searchParams.get('active');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('vendors')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('name');

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`);
    }

    if (active === 'true') {
      query = query.eq('is_active', true);
    } else if (active === 'false') {
      query = query.eq('is_active', false);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/vendors - Create vendor
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Multi-tenant: Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { company_id, ...vendorData } = body;

    // Validate required fields
    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    if (!vendorData.name) {
      return NextResponse.json(
        { error: 'Vendor name is required' },
        { status: 400 }
      );
    }

    // Multi-tenant: Verify user has access to this company
    const { data: membership } = await supabase
      .from('user_companies')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', company_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
    }

    // Generate vendor number using database function
    const { data: numberData, error: numberError } = await supabase
      .rpc('generate_vendor_number');

    if (numberError) {
      return NextResponse.json(
        { error: 'Failed to generate vendor number: ' + numberError.message },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from('vendors')
      .insert({
        company_id,
        vendor_number: numberData,
        name: vendorData.name,
        company_name: vendorData.company_name || null,
        email: vendorData.email || null,
        phone: vendorData.phone || null,
        tax_id: vendorData.tax_id || null,
        address_line1: vendorData.address_line1 || null,
        address_line2: vendorData.address_line2 || null,
        city: vendorData.city || null,
        state: vendorData.state || null,
        zip_code: vendorData.postal_code || null,
        country: vendorData.country || 'USA',
        payment_terms: vendorData.payment_terms || 30,
        default_expense_account_id: vendorData.default_expense_account_id || null,
        notes: vendorData.notes || null,
        is_active: vendorData.is_active !== false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
