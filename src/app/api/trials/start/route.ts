import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

interface StartTrialRequest {
  name: string;
  tier: 'starter' | 'professional' | 'enterprise';
  region: 'AFRICA' | 'ASIA' | 'EU' | 'GB' | 'US' | 'DEFAULT';
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Create authenticated client to get user
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

    // Create admin client with SERVICE ROLE to bypass RLS
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: StartTrialRequest = await request.json();
    const { name, tier, region } = body;

    if (!name || !tier || !region) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user's primary company (created by auth trigger during signup)
    const { data: userCompanies } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single();

    let companyId: string;

    if (!userCompanies) {
      // Create new company for trial using admin client to bypass RLS
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      const { data: newCompany, error: createError } = await adminClient
        .from('companies')
        .insert({
          name,
          subscription_plan: `${tier}-trial`,
          subscription_status: 'trial',
          region,
          currency: 'USD',
          trial_ends_at: trialEndDate.toISOString(),
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

      // Link user to company using admin client
      const { error: linkError } = await adminClient
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
      // Update existing company with trial info
      companyId = userCompanies.company_id;
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      const { error: updateError } = await adminClient
        .from('companies')
        .update({
          name,
          subscription_plan: `${tier}-trial`,
          subscription_status: 'trial',
          region,
          trial_ends_at: trialEndDate.toISOString(),
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

    // Ensure user profile exists using admin client
    const { error: profileError } = await adminClient
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
    }

    // Get the updated/created company
    const { data: company } = await adminClient
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    return NextResponse.json({
      success: true,
      company,
      message: '30-day free trial started!',
    });
  } catch (error: any) {
    console.error('Trial API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
