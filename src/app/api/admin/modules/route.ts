import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { isLegacyPlan } from '@/lib/billing/legacy-plan';
import { AVAILABLE_MODULES } from '@/lib/modules';
import { MODULE_PRICING, mapCountryToRegion, type Region } from '@/lib/regional-pricing';

const MODULE_IDS = Object.keys(AVAILABLE_MODULES).filter((id) => id !== 'core');

// POST /api/admin/modules — turn one add-on module on or off for a company, independent of
// its plan. For a client who asks BlueOx directly to add or remove a module. No Whop/Stripe
// call: there's no real-time payment here, just the database state a paid module normally
// leaves behind.
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const adminError = requirePlatformAdmin(user);
    if (adminError) return adminError;

    const { company_id, module_id, action } = await request.json();
    if (!company_id) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    if (!MODULE_IDS.includes(module_id)) {
      return NextResponse.json({ error: `module_id must be one of: ${MODULE_IDS.join(', ')}` }, { status: 400 });
    }
    if (action !== 'activate' && action !== 'deactivate') {
      return NextResponse.json({ error: "action must be 'activate' or 'deactivate'" }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const companyResult = await tx.query<{ id: string; country: string | null; region: Region | null; subscription_plan: string | null }>(
        'SELECT id, country, region, subscription_plan FROM companies WHERE id = $1 FOR UPDATE',
        [company_id]
      );
      const company = companyResult.rows[0];
      if (!company) return { error: 'Company not found', status: 404 as const };
      if (isLegacyPlan(company.subscription_plan)) {
        return { error: 'This company is on the legacy plan. Manage its modules from the Legacy Plans section instead.', status: 400 as const };
      }

      if (action === 'deactivate') {
        await tx.query(
          `UPDATE subscription_modules SET is_active = false, removed_at = NOW(), updated_at = NOW()
           WHERE company_id = $1 AND module_id = $2 AND is_active = true`,
          [company_id, module_id]
        );
        await tx.query(
          `UPDATE company_modules SET enabled = false WHERE company_id = $1 AND module_id = $2`,
          [company_id, module_id]
        );
        return { module_id, active: false };
      }

      const region: Region = company.region || mapCountryToRegion(company.country || undefined);
      const monthlyPrice = Number((MODULE_PRICING[region] as Record<string, number | string>)[module_id] ?? 0);
      const currency = MODULE_PRICING[region].currencySymbol;

      // Reactivate a previously-removed row first (keeps its history), else insert fresh.
      const reactivated = await tx.query(
        `UPDATE subscription_modules SET is_active = true, removed_at = NULL, updated_at = NOW()
         WHERE company_id = $1 AND module_id = $2 AND is_active = false
         RETURNING id`,
        [company_id, module_id]
      );
      if (!reactivated.rowCount) {
        await tx.query(
          `INSERT INTO subscription_modules (company_id, module_id, monthly_price, currency, is_active, is_trial_module, is_included)
           VALUES ($1, $2, $3, $4, true, false, false)
           ON CONFLICT (company_id, module_id, is_active) DO UPDATE SET updated_at = NOW()`,
          [company_id, module_id, monthlyPrice, currency]
        );
      }
      await tx.query(
        `INSERT INTO company_modules (company_id, module_id, enabled)
         VALUES ($1, $2, true)
         ON CONFLICT (company_id, module_id) DO UPDATE SET enabled = true`,
        [company_id, module_id]
      );

      return { module_id, active: true };
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
