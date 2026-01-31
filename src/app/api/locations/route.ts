import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userCompany, error: companyError } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (companyError || !userCompany) {
      return NextResponse.json({ error: 'No company found for user' }, { status: 403 });
    }

    const companyId = userCompany.company_id;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let query = supabase
      .from('locations')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching locations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userCompany, error: companyError } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (companyError || !userCompany) {
      return NextResponse.json({ error: 'No company found for user' }, { status: 403 });
    }

    const companyId = userCompany.company_id;

    const body = await request.json();
    const {
      name,
      code,
      type,
      address,
      city,
      state,
      postal_code,
      country,
      phone,
      email,
      manager_name,
      is_active
    } = body;

    if (!name || !code || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('locations')
      .insert({
        name,
        code,
        type,
        address,
        city,
        state,
        postal_code,
        country,
        phone,
        email,
        manager_name,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
