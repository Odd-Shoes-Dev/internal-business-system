import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

interface StartTrialRequest {
  tier: 'starter' | 'professional' | 'enterprise';
  region: 'AFRICA' | 'ASIA' | 'EU' | 'GB' | 'US' | 'DEFAULT';
  billingPeriod: 'monthly' | 'annual';
  /** Company name (from signup). Required when creating a new company; optional when updating. */
  name?: string;
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
    const { tier, region, billingPeriod, name: bodyName } = body;

    if (!tier || !region || !billingPeriod) {
      return NextResponse.json(
        { error: 'Missing required fields: tier, region, billingPeriod' },
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
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    if (fetchError || !userCompanies) {
      // No company yet (e.g. trigger didn't run or failed). Create one – name is REQUIRED (DB NOT NULL).
      const metaCompany = (user.user_metadata?.company_name as string)?.trim();
      const metaFullName = (user.user_metadata?.full_name as string)?.trim();
      const emailPrefix = user.email?.split('@')[0] || 'user';
      const companyName =
        bodyName?.trim() ||
        metaCompany ||
        (metaFullName ? metaFullName + "'s Company" : emailPrefix + "'s Company");

      if (!companyName) {
        return NextResponse.json(
          { error: 'Company name is required to start a trial. Please provide "name" in the request body or complete signup with a company name.' },
          { status: 400 }
        );
      }

      const subdomain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '-' + (user.id as string).slice(0, 8);

      const { data: newCompany, error: createError } = await supabaseAdmin
        .from('companies')
        .insert({
          name: companyName,
          subdomain,
          email: user.email ?? null,
          region,
          currency: region === 'AFRICA' ? 'UGX' : region === 'GB' ? 'GBP' : region === 'EU' ? 'EUR' : 'USD',
          subscription_plan: `${tier}-trial`,
          subscription_status: 'trial',
          trial_ends_at: trialEndDate.toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Company creation error:', createError);
        return NextResponse.json(
          { error: 'Failed to create company: ' + (createError.message || 'Unknown error') },
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
          role: 'admin',
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
          subscription_plan: `${tier}-trial`,
          subscription_status: 'trial',
          region,
          trial_ends_at: trialEndDate.toISOString(),
          ...(bodyName?.trim() ? { name: bodyName.trim() } : {}),
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

    // Sync company_settings so dashboard and middleware see subscription_status and trial_end_date
    const { data: existingSettings } = await supabaseAdmin
      .from('company_settings')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    const trialStartDate = new Date();
    if (existingSettings) {
      await supabaseAdmin
        .from('company_settings')
        .update({
          subscription_status: 'trial',
          plan_tier: tier,
          billing_period: billingPeriod,
          trial_end_date: trialEndDate.toISOString(),
        })
        .eq('company_id', companyId);
    } else {
      await supabaseAdmin
        .from('company_settings')
        .insert({
          company_id: companyId,
          subscription_status: 'trial',
          plan_tier: tier,
          billing_period: billingPeriod,
          trial_start_date: trialStartDate.toISOString(),
          trial_end_date: trialEndDate.toISOString(),
        });
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
