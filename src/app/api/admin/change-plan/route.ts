import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { isLegacyPlan } from '@/lib/billing/legacy-plan';

const PLAN_TIERS = ['starter', 'professional', 'enterprise'];

// POST /api/admin/change-plan — switch a company's plan tier with no payment recorded and no
// change to its billing period or current period dates. For a free correction, or an
// immediate downgrade where no proration/refund is being tracked. If a payment is involved,
// use /api/admin/record-payment instead - it also changes the plan tier.
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const adminError = requirePlatformAdmin(user);
    if (adminError) return adminError;

    const { company_id, plan_tier } = await request.json();
    if (!company_id) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    if (!PLAN_TIERS.includes(plan_tier)) {
      return NextResponse.json({ error: `plan_tier must be one of: ${PLAN_TIERS.join(', ')}` }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const companyResult = await tx.query<{ id: string; subscription_plan: string | null }>(
        'SELECT id, subscription_plan FROM companies WHERE id = $1 FOR UPDATE',
        [company_id]
      );
      const company = companyResult.rows[0];
      if (!company) return { error: 'Company not found', status: 404 as const };
      if (isLegacyPlan(company.subscription_plan)) {
        return { error: 'This company is on the legacy plan. Manage it from the Legacy Plans section instead.', status: 400 as const };
      }

      // subscription_plan is stored as "{tier}-{period}" - keep whatever period it already has
      const existingPeriod = company.subscription_plan?.split('-')[1] || 'monthly';

      await tx.query(
        `UPDATE companies SET subscription_plan = $2, updated_at = NOW() WHERE id = $1`,
        [company_id, `${plan_tier}-${existingPeriod}`]
      );
      await tx.query(
        `UPDATE company_settings SET plan_tier = $2, updated_at = NOW() WHERE company_id = $1`,
        [company_id, plan_tier]
      );
      await tx.query(
        `UPDATE subscriptions SET plan_tier = $2, updated_at = NOW()
         WHERE id = (SELECT id FROM subscriptions WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1)`,
        [company_id, plan_tier]
      );

      return { plan_tier };
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
