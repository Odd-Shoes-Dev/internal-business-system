import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function POST(request: NextRequest) {
  try {
    const stripe = await getStripe();
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    // Get user's company
    const profile = await db.query<{ company_id: string }>(
      'SELECT company_id FROM user_profiles WHERE id = $1 LIMIT 1',
      [user.id]
    );
    const companyId = profile.rows[0]?.company_id;

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get company settings with Stripe customer ID
    const settings = await db.query<{ stripe_customer_id: string | null }>(
      'SELECT stripe_customer_id FROM company_settings WHERE company_id = $1 LIMIT 1',
      [companyId]
    );
    const stripeCustomerId = settings.rows[0]?.stripe_customer_id;

    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 });
    }

    // Create Stripe billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create customer portal session' },
      { status: 500 }
    );
  }
}
