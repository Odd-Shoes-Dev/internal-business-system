import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPlanPriceId } from '@/lib/stripe-config';
import { getStripe } from '@/lib/stripe';

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
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    const body = await request.json();
    const { new_plan_tier, billing_period } = body;

    if (!new_plan_tier || !billing_period) {
      return NextResponse.json(
        { error: 'Plan tier and billing period required' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company and check permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (profile.role !== 'owner' && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get company settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('stripe_subscription_id, subscription_status, plan_tier, currency')
      .eq('company_id', profile.company_id)
      .single();

    if (!settings?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    if (settings.subscription_status === 'trial') {
      return NextResponse.json({ error: 'Cannot change plan during trial' }, { status: 400 });
    }

    const stripe = await getStripe();

    // Get current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(settings.stripe_subscription_id);

    // Find the base plan subscription item
    const planItem = subscription.items.data.find(
      (item) => !item.price.metadata?.module_id
    );

    if (!planItem) {
      return NextResponse.json({ error: 'Base plan not found' }, { status: 404 });
    }

    // Get new price ID
    const currency = (settings.currency || 'usd').toLowerCase();
    const newPriceId = getPlanPriceId(new_plan_tier, billing_period, currency);

    if (!newPriceId) {
      return NextResponse.json({ error: 'Invalid plan configuration' }, { status: 400 });
    }

    // Update subscription in Stripe
    await stripe.subscriptions.update(settings.stripe_subscription_id, {
      items: [
        {
          id: planItem.id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    // Update database
    await supabase
      .from('company_settings')
      .update({
        plan_tier: new_plan_tier,
        billing_period: billing_period,
        max_users_allowed: new_plan_tier === 'starter' ? 3 : new_plan_tier === 'professional' ? 10 : 999999,
      })
      .eq('company_id', profile.company_id);

    await supabase
      .from('subscriptions')
      .update({
        plan_tier: new_plan_tier,
        billing_period: billing_period,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', settings.stripe_subscription_id);

    return NextResponse.json({
      success: true,
      message: 'Plan updated successfully',
      new_plan: new_plan_tier,
    });
  } catch (error) {
    console.error('Error changing plan:', error);
    return NextResponse.json(
      { error: 'Failed to change plan' },
      { status: 500 }
    );
  }
}
