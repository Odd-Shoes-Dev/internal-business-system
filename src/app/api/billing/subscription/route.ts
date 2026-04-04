import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
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
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get subscription details
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // If no subscription in subscriptions table, check/create company_settings for trial
    if (subError || !subscription) {
      // Fetch the authoritative trial end date from the companies table first
      const { data: companyData } = await supabase
        .from('companies')
        .select('trial_ends_at, subscription_status, created_at')
        .eq('id', profile.company_id)
        .single();

      // First check if company_settings exists
      let { data: settings, error: settingsError } = await supabase
        .from('company_settings')
        .select(`
          subscription_status,
          plan_tier,
          billing_period,
          trial_start_date,
          trial_end_date,
          current_period_start,
          current_period_end,
          stripe_customer_id,
          stripe_subscription_id,
          company_id
        `)
        .eq('company_id', profile.company_id)
        .single();

      // If company_settings doesn't exist, create it using the real trial end from companies table
      if (settingsError || !settings) {
        const now = new Date();
        // Use companies.trial_ends_at as the authoritative end date.
        // Fall back to created_at + 30 days only if trial_ends_at is missing.
        const trialEnd = companyData?.trial_ends_at
          ? new Date(companyData.trial_ends_at)
          : new Date((companyData?.created_at ? new Date(companyData.created_at).getTime() : now.getTime()) + 30 * 24 * 60 * 60 * 1000);

        const { data: newSettings, error: insertError } = await supabase
          .from('company_settings')
          .insert({
            company_id: profile.company_id,
            subscription_status: companyData?.subscription_status || 'trial',
            plan_tier: 'professional',
            billing_period: 'monthly',
            trial_start_date: companyData?.created_at || now.toISOString(),
            trial_end_date: trialEnd.toISOString(),
          })
          .select()
          .single();

        if (insertError || !newSettings) {
          console.error('Failed to create company_settings:', insertError);
          return NextResponse.json({ error: 'Failed to initialize subscription' }, { status: 500 });
        }

        settings = newSettings;
      }

      // At this point settings should exist, but check to be safe
      if (!settings) {
        return NextResponse.json({ error: 'Failed to load subscription settings' }, { status: 500 });
      }

      const now2 = new Date();
      const trialStart = settings.trial_start_date ? new Date(settings.trial_start_date) : now2;
      // Always prefer companies.trial_ends_at as the authoritative trial end date.
      // This prevents drifting caused by auto-created company_settings using wrong dates.
      const trialEnd = companyData?.trial_ends_at
        ? new Date(companyData.trial_ends_at)
        : (settings.trial_end_date ? new Date(settings.trial_end_date) : new Date(now2.getTime() + 30 * 24 * 60 * 60 * 1000));

      // Sync company_settings.trial_end_date if it differs from companies.trial_ends_at
      if (companyData?.trial_ends_at && settings.trial_end_date !== companyData.trial_ends_at) {
        await supabase
          .from('company_settings')
          .update({ trial_end_date: companyData.trial_ends_at })
          .eq('company_id', profile.company_id);
      }

      // If no subscription_status is set, update it
      if (!settings.subscription_status || !settings.trial_start_date) {
        await supabase
          .from('company_settings')
          .update({
            subscription_status: companyData?.subscription_status || 'trial',
            trial_start_date: trialStart.toISOString(),
            trial_end_date: trialEnd.toISOString(),
            plan_tier: settings.plan_tier || 'professional',
            billing_period: settings.billing_period || 'monthly',
          })
          .eq('company_id', profile.company_id);
      }

      // Return trial subscription data
      const trialSubscription = {
        id: 'trial',
        plan_tier: settings.plan_tier || 'professional',
        billing_period: settings.billing_period || 'monthly',
        status: settings.subscription_status || 'trial',
        base_price_amount: 0,
        currency: 'usd',
        current_period_start: trialStart.toISOString(),
        current_period_end: trialEnd.toISOString(),
        trial_end_date: trialEnd.toISOString(),
      };

      // Get trial modules
      const { data: modules } = await supabase
        .from('subscription_modules')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('added_at', { ascending: true });

      // Get module quota from company_settings
      const { data: quotaData } = await supabase
        .from('company_settings')
        .select('included_modules_quota')
        .eq('company_id', profile.company_id)
        .single();

      const moduleQuota = quotaData?.included_modules_quota || (settings.plan_tier === 'professional' ? 3 : 1);
      const includedModules = (modules || []).filter(m => m.is_included);
      const paidModules = (modules || []).filter(m => !m.is_included);

      return NextResponse.json({
        subscription: trialSubscription,
        modules: modules || [],
        moduleQuota: {
          total: moduleQuota,
          included: includedModules.length,
          paid: paidModules.length,
          remaining: Math.max(0, moduleQuota - includedModules.length),
        },
        includedModules,
        paidModules,
      });
    }

    // Get active modules
    const { data: modules } = await supabase
      .from('subscription_modules')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .order('added_at', { ascending: true });

    // Get module quota
    const { data: quotaData } = await supabase
      .from('company_settings')
      .select('included_modules_quota')
      .eq('company_id', profile.company_id)
      .single();

    const moduleQuota = quotaData?.included_modules_quota || (subscription.plan_tier === 'professional' ? 3 : 1);
    const includedModules = (modules || []).filter(m => m.is_included);
    const paidModules = (modules || []).filter(m => !m.is_included);

    return NextResponse.json({
      subscription,
      modules: modules || [],
      moduleQuota: {
        total: moduleQuota,
        included: includedModules.length,
        paid: paidModules.length,
        remaining: Math.max(0, moduleQuota - includedModules.length),
      },
      includedModules,
      paidModules,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}
