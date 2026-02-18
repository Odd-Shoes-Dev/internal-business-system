import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

interface CreateCompanyRequest {
  name: string;
  tier: 'starter' | 'professional' | 'enterprise';
  region: 'AFRICA' | 'ASIA' | 'EU' | 'GB' | 'US' | 'DEFAULT';
  billingPeriod: 'monthly' | 'annual';
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateCompanyRequest = await request.json();
    const { name, tier, region, billingPeriod } = body;

    if (!name || !tier || !region || !billingPeriod) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user's primary company (created by auth trigger during signup)
    const { data: userCompanies, error: fetchError } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single();

    let companyId: string;

    if (fetchError || !userCompanies) {
      // If no company exists, create one (fallback)
      const { data: newCompany, error: createError } = await supabase
        .from('companies')
        .insert({
          name,
          subscription_plan: `${tier}-${billingPeriod}`,
          subscription_status: 'active',
          region,
          currency: 'USD',
        })
        .select()
        .single();

      if (createError) {
        console.error('Company creation error:', createError);
        return NextResponse.json(
          { error: 'Failed to create company' },
          { status: 500 }
        );
      }

      companyId = newCompany.id;

      // Link user to the new company
      const { error: linkError } = await supabase
        .from('user_companies')
        .insert({
          user_id: user.id,
          company_id: newCompany.id,
          is_primary: true,
          role: 'owner',
        });

      if (linkError) {
        console.error('User company link error:', linkError);
        return NextResponse.json(
          { error: 'Failed to link user to company' },
          { status: 500 }
        );
      }
    } else {
      // Update existing company with subscription info
      companyId = userCompanies.company_id;

      const { error: updateError } = await supabase
        .from('companies')
        .update({
          name,
          subscription_plan: `${tier}-${billingPeriod}`,
          subscription_status: 'active',
          region,
        })
        .eq('id', companyId);

      if (updateError) {
        console.error('Company update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update company' },
          { status: 500 }
        );
      }
    }

    // Ensure user profile exists with company_id
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || '',
        is_active: true,
        company_id: companyId,
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('User profile upsert error:', profileError);
      // Don't fail - profile might already exist
    }

    // Get the updated/created company
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    return NextResponse.json({
      success: true,
      company,
    });
  } catch (error: any) {
    console.error('Onboarding API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
