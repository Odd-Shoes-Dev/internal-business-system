import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { isLegacyPlan } from '@/lib/billing/legacy-plan';
import { AVAILABLE_MODULES } from '@/lib/modules';
import { MODULE_PRICING, mapCountryToRegion, type Region } from '@/lib/regional-pricing';

// GET /api/admin/company-overview?company_id= — everything the "Manage Company" panel needs
// once a company is picked: its current plan/subscription, and every add-on module with its
// active state and regional price.
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const adminError = requirePlatformAdmin(user);
    if (adminError) return adminError;

    const companyId = request.nextUrl.searchParams.get('company_id');
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

    const companyResult = await db.query<{
      id: string; name: string; country: string | null; region: Region | null;
      subscription_plan: string | null; subscription_status: string | null;
    }>(
      `SELECT id, name, country, region, subscription_plan, subscription_status
       FROM companies WHERE id = $1 LIMIT 1`,
      [companyId]
    );
    const company = companyResult.rows[0];
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    if (isLegacyPlan(company.subscription_plan)) {
      return NextResponse.json(
        { error: 'This company is on the legacy plan. Manage it from the Legacy Plans section instead.' },
        { status: 400 }
      );
    }

    // companies.region is set once a company's own checkout runs; fall back to their country
    // the same way billing/change-plan does, for a company that's never been through that.
    const region: Region = company.region || mapCountryToRegion(company.country || undefined);

    const subscriptionResult = await db.query<{
      plan_tier: string; billing_period: string; status: string;
      current_period_start: string; current_period_end: string;
      base_price_amount: string; currency: string;
    }>(
      `SELECT plan_tier, billing_period, status, current_period_start, current_period_end,
              base_price_amount, currency
       FROM subscriptions WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [companyId]
    );

    const activeModulesResult = await db.query<{ module_id: string }>(
      `SELECT module_id FROM subscription_modules WHERE company_id = $1 AND is_active = TRUE`,
      [companyId]
    );
    const activeModuleIds = new Set(activeModulesResult.rows.map((r) => r.module_id));

    const modulePricing = MODULE_PRICING[region];
    const modules = Object.values(AVAILABLE_MODULES)
      .filter((m) => m.id !== 'core')
      .map((m) => ({
        id: m.id,
        name: m.name,
        active: activeModuleIds.has(m.id),
        price: (modulePricing as Record<string, number | string>)[m.id] ?? 0,
        currency: modulePricing.currencySymbol,
      }));

    return NextResponse.json({
      data: {
        company: { id: company.id, name: company.name, country: company.country, region },
        subscription: subscriptionResult.rows[0] || null,
        modules,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
