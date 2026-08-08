import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    // Get user's company and check they're an owner or admin
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

    const companyId = profileRow.company_id;

    // Get company subscription settings
    const settings = await db.query<{
      stripe_subscription_id: string | null;
      subscription_status: string | null;
    }>(
      'SELECT stripe_subscription_id, subscription_status FROM company_settings WHERE company_id = $1 LIMIT 1',
      [companyId]
    );
    const settingsRow = settings.rows[0];

    if (settingsRow?.subscription_status === 'trial') {
      return NextResponse.json({ error: 'Cannot cancel trial subscription' }, { status: 400 });
    }

    const markCancelledInDb = async () => {
      await db.query(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE company_id = $1`,
        [companyId]
      );
      await db.query(
        `UPDATE company_settings SET subscription_status = 'cancelled', updated_at = NOW() WHERE company_id = $1`,
        [companyId]
      );
      await db.query(
        `UPDATE companies SET subscription_status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [companyId]
      );
    };

    // Stripe subscription — cancel at period end via Stripe API
    if (settingsRow?.stripe_subscription_id) {
      const stripe = await getStripe();
      const subscription = await stripe.subscriptions.update(
        settingsRow.stripe_subscription_id,
        { cancel_at_period_end: true }
      );
      await markCancelledInDb();
      return NextResponse.json({
        success: true,
        message: 'Subscription cancelled. Access will continue until the end of your billing period.',
        cancel_at: new Date(subscription.cancel_at! * 1000).toISOString(),
      });
    }

    // Whop subscription — mark cancelled in DB.
    // Whop will fire membership.deactivated webhook on their end to confirm.
    const activeSubResult = await db.query<{ id: string }>(
      `SELECT id FROM subscriptions WHERE company_id = $1 AND status = 'active' LIMIT 1`,
      [companyId]
    );
    if (activeSubResult.rows[0]) {
      await markCancelledInDb();
      return NextResponse.json({
        success: true,
        message: 'Subscription cancelled. Please also cancel directly in your Whop account to stop future billing.',
      });
    }

    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
