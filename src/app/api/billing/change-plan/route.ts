import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';
import { getWhop } from '@/lib/whop';
import { getPlanId } from '@/lib/whop-config';
import { detectRegionFromRequest } from '@/lib/detect-ip-region';
import type { Region } from '@/lib/regional-pricing';

const VALID_REGIONS: Region[] = ['AFRICA', 'ASIA', 'EU', 'GB', 'US', 'DEFAULT'];

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const body = await request.json();
    // Accept both camelCase (upgrade page) and snake_case
    const new_plan_tier = body.new_plan_tier ?? body.newPlanTier;
    const billing_period = body.billing_period ?? body.billingPeriod ?? 'monthly';

    if (!new_plan_tier) {
      return NextResponse.json(
        { error: 'Plan tier is required' },
        { status: 400 }
      );
    }

    // Get user's company and check permissions (multi-tenant schema)
    const uc = await db.query<{ company_id: string; role: string }>(
      `SELECT company_id, role FROM user_companies
       WHERE user_id = $1
       ORDER BY is_primary DESC, joined_at ASC
       LIMIT 1`,
      [user.id]
    );
    const userCompanyRow = uc.rows[0];

    if (!userCompanyRow?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Allow owner/admin of company, or global app admin
    const canManage = ['owner', 'admin'].includes(userCompanyRow.role) || user.role === 'admin';
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Enforce region from DB — never trust client
    const companyResult = await db.query(
      'SELECT region FROM companies WHERE id = $1 LIMIT 1',
      [userCompanyRow.company_id]
    );
    const dbRegion = companyResult.rows[0]?.region as Region | null;
    let region: Region;
    if (dbRegion && VALID_REGIONS.includes(dbRegion) && dbRegion !== 'DEFAULT') {
      region = dbRegion;
    } else {
      region = await detectRegionFromRequest(request);
      await db.query('UPDATE companies SET region = $1, updated_at = NOW() WHERE id = $2', [region, userCompanyRow.company_id]);
    }

    // Resolve Whop plan ID for the new plan
    const whopPlanId = getPlanId(new_plan_tier, billing_period, region);
    if (!whopPlanId) {
      return NextResponse.json({ error: 'Plan not available for your region' }, { status: 400 });
    }

    // Create a Whop checkout session for the new plan
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const whop = await getWhop();
    const checkoutConfig = await whop.checkoutConfigurations.create({
      plan_id: whopPlanId,
      ...(appUrl.startsWith('https://') ? { redirect_url: `${appUrl}/dashboard/billing` } : {}),
      metadata: {
        company_id: userCompanyRow.company_id,
        user_id: user.id,
        plan_tier: new_plan_tier,
        billing_period,
        display_region: region,
        action: 'plan_change',
      },
    });

    return NextResponse.json({
      success: true,
      url: checkoutConfig.checkout_url,
      message: 'Redirecting to checkout to complete plan change',
    });
  } catch (error) {
    console.error('Error changing plan:', error);
    return NextResponse.json(
      { error: 'Failed to initiate plan change' },
      { status: 500 }
    );
  }
}
