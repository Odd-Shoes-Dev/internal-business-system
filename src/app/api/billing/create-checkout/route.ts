import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getWhop } from '@/lib/whop';
import { getPlanId, getModulePlanId } from '@/lib/whop-config';
import { detectRegion } from '@/lib/regional-pricing';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const plan_tier = body.plan_tier ?? body.planTier;
    const billing_period = body.billing_period ?? body.billingPeriod;
    const module_ids = body.module_ids ?? body.moduleIds ?? [];

    // Authenticate user from supabase auth cookie/header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.company_id) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    const companyId = profile.company_id;

    if (!plan_tier || !billing_period) {
      return NextResponse.json(
        { error: 'Missing plan_tier or billing_period' },
        { status: 400 }
      );
    }

    // Detect display region for pricing
    const displayRegion = detectRegion();

    // Resolve Whop plan IDs
    const basePlanId = getPlanId(plan_tier, billing_period, displayRegion as any);
    const modulePlanIds = module_ids.map((m: string) => getModulePlanId(m, displayRegion as any));

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
