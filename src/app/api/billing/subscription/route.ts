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

    // If no subscription in subscriptions table, check company_settings for trial
    if (subError || !subscription) {
      const { data: settings } = await supabase
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
          stripe_subscription_id
        `)
        .eq('company_id', profile.company_id)
        .single();

      if (settings?.subscription_status === 'trial') {
        // Return trial subscription data
        const trialSubscription = {
          id: 'trial',
          plan_tier: settings.plan_tier || 'professional',
          billing_period: settings.billing_period || 'monthly',
          status: 'trial',
          base_price_amount: 0,
          currency: 'usd',
          current_period_start: settings.trial_start_date,
          current_period_end: settings.trial_end_date,
          trial_end_date: settings.trial_end_date,
        };

        // Get trial modules
        const { data: modules } = await supabase
          .from('subscription_modules')
          .select('*')
          .eq('company_id', profile.company_id)
          .eq('is_active', true);

        return NextResponse.json({
          subscription: trialSubscription,
          modules: modules || [],
        });
      }

      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    // Get active modules
    const { data: modules } = await supabase
      .from('subscription_modules')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .order('added_at', { ascending: true });

    return NextResponse.json({
      subscription,
      modules: modules || [],
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}
