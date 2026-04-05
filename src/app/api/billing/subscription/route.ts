import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
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

    // Get subscription details
    const subResult = await db.query(
      `SELECT *
       FROM subscriptions
       WHERE company_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [companyId]
    );

    const subscription = subResult.rows[0] ?? null;

    // If no subscription in subscriptions table, check/create company_settings for trial
    if (!subscription) {
      // Fetch the authoritative trial end date from the companies table first
      const companyResult = await db.query<{
        trial_ends_at: string | null;
        subscription_status: string | null;
        created_at: string | null;
      }>(
        'SELECT trial_ends_at, subscription_status, created_at FROM companies WHERE id = $1 LIMIT 1',
        [companyId]
      );
      const companyData = companyResult.rows[0] ?? null;

      // First check if company_settings exists
      const settingsResult = await db.query(
        `SELECT
          subscription_status,
          plan_tier,
          billing_period,
          trial_start_date,
          trial_end_date,
          current_period_start,
          current_period_end,
          stripe_customer_id,
          stripe_subscription_id,
          included_modules_quota,
          company_id
         FROM company_settings
         WHERE company_id = $1
         LIMIT 1`,
        [companyId]
      );

      let settings = settingsResult.rows[0] ?? null;

      // If company_settings doesn't exist, create it using the real trial end from companies table
      if (!settings) {
        const now = new Date();
        // Use companies.trial_ends_at as the authoritative end date.
        // Fall back to created_at + 30 days only if trial_ends_at is missing.
        const trialEnd = companyData?.trial_ends_at
          ? new Date(companyData.trial_ends_at)
          : new Date((companyData?.created_at ? new Date(companyData.created_at).getTime() : now.getTime()) + 30 * 24 * 60 * 60 * 1000);

        const newSettings = await db.query(
          `INSERT INTO company_settings (
             company_id, subscription_status, plan_tier, billing_period, trial_start_date, trial_end_date
           )
           VALUES ($1, $2, 'professional', 'monthly', $3, $4)
           RETURNING *`,
          [
            companyId,
            companyData?.subscription_status || 'trial',
            companyData?.created_at || now.toISOString(),
            trialEnd.toISOString(),
          ]
        );

        settings = newSettings.rows[0] ?? null;
      }

      // At this point settings should exist, but check to be safe
      if (!settings) {
        return NextResponse.json({ error: 'Failed to load subscription settings' }, { status: 500 });
      }

      const now2 = new Date();
      const trialStart = settings.trial_start_date ? new Date(settings.trial_start_date) : now2;
      // Always prefer companies.trial_ends_at as the authoritative trial end date.
      // This prevents drifting caused by auto-created company_settings using wrong dates.
      const trialEnd = companyData?.trial_ends_at
        ? new Date(companyData.trial_ends_at)
        : (settings.trial_end_date ? new Date(settings.trial_end_date) : new Date(now2.getTime() + 30 * 24 * 60 * 60 * 1000));
      const effectiveStatus = companyData?.subscription_status === 'expired' || trialEnd < now2
        ? 'expired'
        : (companyData?.subscription_status || settings.subscription_status || 'trial');

      // Sync company_settings.trial_end_date if it differs from companies.trial_ends_at
      if (companyData?.trial_ends_at && settings.trial_end_date !== companyData.trial_ends_at) {
        await db.query(
          'UPDATE company_settings SET trial_end_date = $2 WHERE company_id = $1',
          [companyId, companyData.trial_ends_at]
        );
      }

      // If no subscription_status is set, update it
      if (!settings.subscription_status || settings.subscription_status !== effectiveStatus || !settings.trial_start_date) {
        await db.query(
          `UPDATE company_settings
           SET subscription_status = $2,
               trial_start_date = $3,
               trial_end_date = $4,
               plan_tier = $5,
               billing_period = $6
           WHERE company_id = $1`,
          [
            companyId,
            effectiveStatus,
            trialStart.toISOString(),
            trialEnd.toISOString(),
            settings.plan_tier || 'professional',
            settings.billing_period || 'monthly',
          ]
        );
      }

      // Return trial subscription data
      const trialSubscription = {
        id: 'trial',
        plan_tier: settings.plan_tier || 'professional',
        billing_period: settings.billing_period || 'monthly',
        status: effectiveStatus,
        base_price_amount: 0,
        currency: 'usd',
        current_period_start: trialStart.toISOString(),
        current_period_end: trialEnd.toISOString(),
        trial_end_date: trialEnd.toISOString(),
      };

      // Get trial modules
      const modulesResult = await db.query(
        `SELECT *
         FROM subscription_modules
         WHERE company_id = $1
           AND is_active = TRUE
         ORDER BY added_at ASC`,
        [companyId]
      );
      const modules = modulesResult.rows;

      // Get module quota from company_settings
      const quotaResult = await db.query<{ included_modules_quota: number | null }>(
        'SELECT included_modules_quota FROM company_settings WHERE company_id = $1 LIMIT 1',
        [companyId]
      );
      const quotaData = quotaResult.rows[0] ?? null;

      const moduleQuota = quotaData?.included_modules_quota || (settings.plan_tier === 'professional' ? 3 : 1);
      const includedModules = (modules || []).filter(m => m.is_included);
      const paidModules = (modules || []).filter(m => !m.is_included);

      return NextResponse.json({
        subscription: trialSubscription,
        modules: modules || [],
        moduleQuota: {
          total: moduleQuota,
          included: includedModules.length,
          paid: paidModules.length,
          remaining: Math.max(0, moduleQuota - includedModules.length),
        },
        includedModules,
        paidModules,
      });
    }

    // Get active modules
    const modulesResult = await db.query(
      `SELECT *
       FROM subscription_modules
       WHERE company_id = $1
         AND is_active = TRUE
       ORDER BY added_at ASC`,
      [companyId]
    );
    const modules = modulesResult.rows;

    // Get module quota
    const quotaResult = await db.query<{ included_modules_quota: number | null }>(
      'SELECT included_modules_quota FROM company_settings WHERE company_id = $1 LIMIT 1',
      [companyId]
    );
    const quotaData = quotaResult.rows[0] ?? null;

    const moduleQuota = quotaData?.included_modules_quota || (subscription.plan_tier === 'professional' ? 3 : 1);
    const includedModules = (modules || []).filter(m => m.is_included);
    const paidModules = (modules || []).filter(m => !m.is_included);

    return NextResponse.json({
      subscription,
      modules: modules || [],
      moduleQuota: {
        total: moduleQuota,
        included: includedModules.length,
        paid: paidModules.length,
        remaining: Math.max(0, moduleQuota - includedModules.length),
      },
      includedModules,
      paidModules,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

