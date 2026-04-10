import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';
import { getWhop } from '@/lib/whop';
import { getPlanId, getModulePlanId } from '@/lib/whop-config';
import { detectRegionFromRequest } from '@/lib/detect-ip-region';
import type { Region } from '@/lib/regional-pricing';

const VALID_REGIONS: Region[] = ['AFRICA', 'ASIA', 'EU', 'GB', 'US', 'DEFAULT'];

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

    const db = getDbProvider();
    const user = await db.getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await db.query(
      'SELECT company_id FROM user_profiles WHERE id = $1 LIMIT 1',
      [user.id]
    );

    const companyId = profile.rows[0]?.company_id;
    if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    // Enforce region from DB — never trust the client-supplied value
    const companyResult = await db.query(
      'SELECT region FROM companies WHERE id = $1 LIMIT 1',
      [companyId]
    );
    const dbRegion = companyResult.rows[0]?.region as Region | null;

    let displayRegion: Region;
    if (dbRegion && VALID_REGIONS.includes(dbRegion) && dbRegion !== 'DEFAULT') {
      // Company already has a locked region — use it regardless of what client sent
      displayRegion = dbRegion;
    } else {
      // No region set yet — detect from IP and lock it into the company record
      displayRegion = await detectRegionFromRequest(request);
      await db.query(
        'UPDATE companies SET region = $1, updated_at = NOW() WHERE id = $2',
        [displayRegion, companyId]
      );
    }

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
