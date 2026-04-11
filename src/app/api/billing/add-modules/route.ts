import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';
import { getModulePlanId } from '@/lib/whop-config';
import { getWhop } from '@/lib/whop';
import { Region } from '@/lib/regional-pricing';

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const { module_ids, company_id: bodyCompanyId } = body;

    if (!module_ids || !Array.isArray(module_ids) || module_ids.length === 0) {
      return NextResponse.json({ error: 'Module IDs required' }, { status: 400 });
    }

    // Get company_id and role from user_companies (multi-tenant schema)
    let companyId: string;
    let userRole: string;

    if (bodyCompanyId) {
      const ucResult = await db.query<{ role: string }>(
        'SELECT role FROM user_companies WHERE user_id = $1 AND company_id = $2 LIMIT 1',
        [user.id, bodyCompanyId]
      );
      if (!ucResult.rows[0]) {
        return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 });
      }
      companyId = bodyCompanyId;
      userRole = ucResult.rows[0].role;
    } else {
      // Fall back to primary company
      const ucResult = await db.query<{ company_id: string; role: string }>(
        `SELECT company_id, role FROM user_companies
         WHERE user_id = $1
         ORDER BY is_primary DESC, joined_at ASC
         LIMIT 1`,
        [user.id]
      );
      if (!ucResult.rows[0]) {
        return NextResponse.json({ error: 'No company found for this user' }, { status: 404 });
      }
      companyId = ucResult.rows[0].company_id;
      userRole = ucResult.rows[0].role;
    }

    // Allow owner, admin (company role) OR if global app_users role is admin
    const canManage = ['owner', 'admin'].includes(userRole) || user.role === 'admin';
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const now = new Date();

    // Get company info (subscription status + region)
    const companyResult = await db.query<{
      subscription_status: string | null;
      trial_ends_at: string | null;
      region: string | null;
    }>(
      'SELECT subscription_status, trial_ends_at, region FROM companies WHERE id = $1 LIMIT 1',
      [companyId]
    );
    const companyRow = companyResult.rows[0];

    // Get company settings
    const settingsResult = await db.query<{
      subscription_status: string | null;
      base_currency: string | null;
      included_modules_quota: number | null;
      plan_tier: string | null;
    }>(
      'SELECT subscription_status, base_currency, included_modules_quota, plan_tier FROM company_settings WHERE company_id = $1 LIMIT 1',
      [companyId]
    );
    const settingsRow = settingsResult.rows[0];

    if (!settingsRow) {
      return NextResponse.json({ error: 'Company settings not found' }, { status: 404 });
    }

    const subscriptionStatus = companyRow?.subscription_status || settingsRow.subscription_status;
    const trialEndsAt = companyRow?.trial_ends_at ? new Date(companyRow.trial_ends_at) : null;
    const isTrialActive = subscriptionStatus === 'trial' && (!trialEndsAt || trialEndsAt > now);
    const isActiveSubscription = subscriptionStatus === 'active';

    if (!isTrialActive && !isActiveSubscription) {
      return NextResponse.json(
        { error: 'No active subscription. Please upgrade your plan before adding modules.' },
        { status: 403 }
      );
    }

    // Module quota
    const moduleQuota = settingsRow.included_modules_quota ?? (
      settingsRow.plan_tier === 'professional' ? 3 :
      settingsRow.plan_tier === 'enterprise' ? 999 :
      1
    );

    // Count current included modules (graceful fallback if table doesn't exist)
    let currentIncludedCount = 0;
    try {
      const countResult = await db.query<{ total: string }>(
        'SELECT COUNT(*)::text AS total FROM subscription_modules WHERE company_id = $1 AND is_active = TRUE AND is_included = TRUE',
        [companyId]
      );
      currentIncludedCount = Number(countResult.rows[0]?.total || 0);
    } catch {
      currentIncludedCount = 0;
    }

    const remainingQuota = Math.max(0, moduleQuota - currentIncludedCount);

    // Bucket modules into included (within quota) vs paid (beyond quota)
    const includedModuleIds: string[] = [];
    const paidModuleIds: string[] = [];

    for (const moduleId of module_ids) {
      // Skip already-active modules
      let alreadyActive = false;
      try {
        const existing = await db.query(
          'SELECT id FROM subscription_modules WHERE company_id = $1 AND module_id = $2 AND is_active = TRUE LIMIT 1',
          [companyId, moduleId]
        );
        alreadyActive = existing.rowCount > 0;
      } catch { /* table may not exist */ }

      if (alreadyActive) continue;

      if (includedModuleIds.length < remainingQuota) {
        includedModuleIds.push(moduleId);
      } else {
        paidModuleIds.push(moduleId);
      }
    }

    // Add included modules to DB right away
    const currency = (settingsRow.base_currency || 'USD').toUpperCase();
    const addedIncluded = await insertModules(db, companyId, includedModuleIds, currency, isTrialActive, true);

    // Any out-of-quota modules → always go to Whop checkout (trial or active)
    if (paidModuleIds.length > 0) {
      const region = ((companyRow?.region as Region) || 'DEFAULT') as Region;
      const planIds = paidModuleIds
        .map((m) => getModulePlanId(m, region))
        .filter(Boolean) as string[];

      if (planIds.length === 0) {
        return NextResponse.json(
          { error: 'No pricing available for selected modules in your region. Please contact support.' },
          { status: 400 }
        );
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const whop = await getWhop();
      const checkout = await whop.checkoutConfigurations.create({
        plan_id: planIds[0],
        ...(appUrl.startsWith('https://') ? { redirect_url: `${appUrl}/dashboard/billing` } : {}),
        metadata: {
          company_id: companyId,
          module_ids: paidModuleIds.join(','),
          action: 'add_modules',
        },
      });

      return NextResponse.json({
        success: true,
        checkout_url: checkout.purchase_url,
        included_added: addedIncluded.length,
        paid_pending: paidModuleIds,
        message: `${addedIncluded.length} module(s) added. Redirecting to payment for ${paidModuleIds.length} additional module(s).`,
      });
    }

    return NextResponse.json({
      success: true,
      added_modules: addedIncluded,
      message: `${addedIncluded.length} module(s) added successfully`,
      breakdown: {
        included: addedIncluded.length,
        paid: 0,
        remainingQuota: Math.max(0, remainingQuota - addedIncluded.length),
      },
    });
  } catch (error) {
    console.error('Error adding modules:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add modules' },
      { status: 500 }
    );
  }
}

async function insertModules(
  db: any,
  companyId: string,
  moduleIds: string[],
  currency: string,
  isTrialModule: boolean,
  isIncluded: boolean
): Promise<any[]> {
  const added: any[] = [];
  for (const moduleId of moduleIds) {
    try {
      // Upsert into subscription_modules — unique constraint is (company_id, module_id, is_active)
      // First activate any existing inactive row, then insert if needed
      const updateResult = await db.query(
        `UPDATE subscription_modules SET is_active = TRUE, updated_at = NOW()
         WHERE company_id = $1 AND module_id = $2 AND is_active = FALSE`,
        [companyId, moduleId]
      );
      if (updateResult.rowCount === 0) {
        const result = await db.query(
          `INSERT INTO subscription_modules (company_id, module_id, monthly_price, currency, is_active, is_trial_module, is_included)
           VALUES ($1, $2, 0, $3, TRUE, $4, $5)
           ON CONFLICT (company_id, module_id, is_active) DO UPDATE SET updated_at = NOW()
           RETURNING *`,
          [companyId, moduleId, currency, isTrialModule, isIncluded]
        );
        if (result.rowCount > 0) added.push(result.rows[0]);
      } else {
        added.push({ module_id: moduleId, company_id: companyId, is_active: true });
      }
      // Also sync into company_modules (enabled column)
      await db.query(
        `INSERT INTO company_modules (company_id, module_id, enabled)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (company_id, module_id) DO UPDATE SET enabled = TRUE
         RETURNING *`,
        [companyId, moduleId]
      );
    } catch (e) {
      console.error(`Failed to insert module ${moduleId}:`, e);
    }
  }
  return added;
}
