import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

interface StartTrialRequest {
  tier: 'starter' | 'professional' | 'enterprise';
  region: 'AFRICA' | 'ASIA' | 'EU' | 'GB' | 'US' | 'DEFAULT';
  billingPeriod: 'monthly' | 'annual';
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient();
    const supabaseAdmin = createServiceClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: StartTrialRequest = await request.json();
    const { tier, region, billingPeriod } = body;

    if (!tier || !region || !billingPeriod) {
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

    let companyId: string | undefined;

    if (fetchError || !userCompanies) {
      // Create new company using service client
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);
      const { data: newCompany, error: createError } = await supabaseAdmin
        .from('companies')
        .insert({
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

      const { error: linkError } = await supabaseAdmin
        .from('user_companies')
        .insert({
          user_id: user.id,
          company_id: companyId,
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
      companyId = userCompanies.company_id;

      const { error: updateError } = await supabaseAdmin
        .from('companies')
        .update({
          subscription_plan: `${tier}-${billingPeriod}`,
          subscription_status: 'trial',
          region,
        })
        .eq('id', companyId);

      if (updateError) {
        console.error('Company update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to start trial' },
          { status: 500 }
        );
      }
    }

    // Ensure user profile exists with company_id using service client
    const { error: profileError } = await supabaseAdmin
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

    // Get the updated company
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    return NextResponse.json({
      success: true,
      company,
      message: '30-day free trial started successfully',
    });
  } catch (error: any) {
    console.error('Trial API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
