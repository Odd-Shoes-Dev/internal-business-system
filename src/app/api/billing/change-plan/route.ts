import { NextRequest, NextResponse } from 'next/server';
import { getPlanPriceId } from '@/lib/stripe-config';
import { getStripe } from '@/lib/stripe';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const body = await request.json();
    const { new_plan_tier, billing_period } = body;

    if (!new_plan_tier || !billing_period) {
      return NextResponse.json(
        { error: 'Plan tier and billing period required' },
        { status: 400 }
      );
    }

    // Get user's company and check permissions
    const profile = await db.query<{ company_id: string; role: string }>(
      'SELECT company_id, role FROM user_profiles WHERE id = $1 LIMIT 1',
      [user.id]
    );
    const profileRow = profile.rows[0];

    if (!profileRow?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (profileRow.role !== 'owner' && profileRow.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get company settings
    const settings = await db.query<{
      stripe_subscription_id: string | null;
      subscription_status: string | null;
      plan_tier: string | null;
      currency: string | null;
    }>(
      'SELECT stripe_subscription_id, subscription_status, plan_tier, currency FROM company_settings WHERE company_id = $1 LIMIT 1',
      [profileRow.company_id]
    );
    const settingsRow = settings.rows[0];

    if (!settingsRow?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    if (settingsRow.subscription_status === 'trial') {
      return NextResponse.json({ error: 'Cannot change plan during trial' }, { status: 400 });
    }

    const stripe = await getStripe();

    // Get current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(settingsRow.stripe_subscription_id);

    // Find the base plan subscription item
    const planItem = subscription.items.data.find(
      (item) => !item.price.metadata?.module_id
    );

    if (!planItem) {
      return NextResponse.json({ error: 'Base plan not found' }, { status: 404 });
    }

    // Get new price ID
    const currencyCode = ((settingsRow.currency || 'USD').toUpperCase() as 'USD' | 'EUR' | 'GBP' | 'UGX');
    const newPriceId = getPlanPriceId(new_plan_tier, billing_period, currencyCode);

    if (!newPriceId) {
      return NextResponse.json({ error: 'Invalid plan configuration' }, { status: 400 });
    }

    // Update subscription in Stripe
    await stripe.subscriptions.update(settingsRow.stripe_subscription_id, {
      items: [
        {
          id: planItem.id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    // Update database
    await db.query(
      `UPDATE company_settings
       SET plan_tier = $2,
           billing_period = $3,
           max_users_allowed = $4,
           updated_at = NOW()
       WHERE company_id = $1`,
      [
        profileRow.company_id,
        new_plan_tier,
        billing_period,
        new_plan_tier === 'starter' ? 3 : new_plan_tier === 'professional' ? 10 : 999999,
      ]
    );

    await db.query(
      `UPDATE subscriptions
       SET plan_tier = $2,
           billing_period = $3,
           updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [settingsRow.stripe_subscription_id, new_plan_tier, billing_period]
    );

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
