import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getWhop } from '@/lib/whop';
import { getPlanId, getModulePlanId } from '@/lib/whop-config';
import type { Region } from '@/lib/regional-pricing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const plan_tier = body.plan_tier ?? body.planTier;
    const billing_period = body.billing_period ?? body.billingPeriod;
    const module_ids = body.module_ids ?? body.moduleIds ?? [];
    const region = body.region ?? body.displayRegion;

    if (!plan_tier || !billing_period) {
      return NextResponse.json(
        { error: 'Missing plan_tier or billing_period' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const supabaseAdmin = createServiceClient();

    // Prefer cookie-based session (for select-plan / browser); fallback to Bearer token
    let user: { id: string; email?: string } | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const { data, error } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
      if (!error && data?.user) user = data.user;
    }
    if (!user) {
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      user = sessionUser;
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    const companyId = profile.company_id;

    const displayRegion: Region = region && ['AFRICA', 'ASIA', 'EU', 'GB', 'US', 'DEFAULT'].includes(region)
      ? region
      : 'DEFAULT';

    // Resolve Whop plan IDs
    const basePlanId = getPlanId(plan_tier, billing_period, displayRegion);
    const modulePlanIds = (module_ids as string[]).map((m) => getModulePlanId(m, displayRegion)).filter(Boolean);

    const whop = await getWhop();

    const checkoutConfig = await whop.checkoutConfigurations.create({
      company_id: process.env.WHOP_COMPANY_ID!,
      plan: undefined, // using plan_ids instead
      plan_ids: [basePlanId, ...modulePlanIds],
      metadata: {
        company_id: companyId,
        user_id: user.id,
        plan_tier,
        billing_period,
        module_ids: JSON.stringify(module_ids),
        display_region: displayRegion,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/upgrade`,
    });

    return NextResponse.json({ sessionId: checkoutConfig.id, url: checkoutConfig.checkout_url });
  } catch (error: any) {
    console.error('Whop checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
  }
}
