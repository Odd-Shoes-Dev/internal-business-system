import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const body = await request.json();
    const { module_ids } = body;

    if (!module_ids || !Array.isArray(module_ids) || module_ids.length === 0) {
      return NextResponse.json({ error: 'Module IDs required' }, { status: 400 });
    }

    // Get user's company and check permissions
    const profile = await db.query<{ company_id: string; role: string }>(
      'SELECT company_id, role FROM user_profiles WHERE id = $1 LIMIT 1',
      [user.id]
    );
    const profileRow = profile.rows[0];

    if (!profileRow?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (profileRow.role !== 'owner' && profileRow.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const now = new Date();

    const company = await db.query<{ subscription_status: string | null; trial_ends_at: string | null }>(
      'SELECT subscription_status, trial_ends_at FROM companies WHERE id = $1 LIMIT 1',
      [profileRow.company_id]
    );
    const companyRow = company.rows[0];

    // Get company settings including module quota
    const settings = await db.query<{
      stripe_subscription_id: string | null;
      subscription_status: string | null;
      currency: string | null;
      included_modules_quota: number | null;
      plan_tier: string | null;
    }>(
      `SELECT stripe_subscription_id, subscription_status, currency, included_modules_quota, plan_tier
       FROM company_settings
       WHERE company_id = $1
       LIMIT 1`,
      [profileRow.company_id]
    );
    const settingsRow = settings.rows[0];

    if (!settingsRow) {
      return NextResponse.json({ error: 'Company settings not found' }, { status: 404 });
    }

    // Get module quota (default based on plan if not set)
    const moduleQuota = settingsRow.included_modules_quota || (
      settingsRow.plan_tier === 'professional' ? 3 :
      settingsRow.plan_tier === 'enterprise' ? 999 :
      1
    );

    // Count current included modules
    const includedCountResult = await db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM subscription_modules
       WHERE company_id = $1
         AND is_active = TRUE
         AND is_included = TRUE`,
      [profileRow.company_id]
    );
    const currentIncludedCount = Number(includedCountResult.rows[0]?.total || 0);
    const remainingQuota = Math.max(0, moduleQuota - currentIncludedCount);

    const trialEndsAt = companyRow?.trial_ends_at ? new Date(companyRow.trial_ends_at) : null;
    const isTrialActive = (companyRow?.subscription_status || settingsRow.subscription_status) === 'trial' && (!trialEndsAt || trialEndsAt > now);
    const hasActivePaidSubscription = Boolean(settingsRow.stripe_subscription_id) && settingsRow.subscription_status === 'active';
    
    if (!isTrialActive && !hasActivePaidSubscription) {
      return NextResponse.json({ error: 'Your trial has ended. Please upgrade your plan before adding modules.' }, { status: 403 });
    }

    if (!hasActivePaidSubscription && module_ids.some((_, index) => index >= remainingQuota)) {
      return NextResponse.json({ error: 'No active subscription found. Please upgrade to add more modules.' }, { status: 404 });
    }

    // Module pricing
    const modulePricing: Record<string, Record<string, number>> = {
      tours: { usd: 39, eur: 35, gbp: 31, ugx: 145000 },
      fleet: { usd: 35, eur: 32, gbp: 28, ugx: 130000 },
      hotels: { usd: 45, eur: 41, gbp: 36, ugx: 167000 },
      cafe: { usd: 35, eur: 32, gbp: 28, ugx: 130000 },
      security: { usd: 29, eur: 26, gbp: 23, ugx: 108000 },
      inventory: { usd: 39, eur: 35, gbp: 31, ugx: 145000 },
    };

    const currency = (settingsRow.currency || 'usd').toLowerCase();
    const addedModules: any[] = [];
    let modulesAddedCount = 0;

    const stripe = await getStripe();

    // Add each module to Stripe subscription
    for (const moduleId of module_ids) {
      // Check if module already exists
      const existing = await db.query(
        `SELECT id
         FROM subscription_modules
         WHERE company_id = $1
           AND module_id = $2
           AND is_active = TRUE
         LIMIT 1`,
        [profileRow.company_id, moduleId]
      );

      if (existing.rowCount > 0) {
        continue; // Skip if already active
      }

      // Determine if this module is included in quota or paid
      const isIncluded = (currentIncludedCount + modulesAddedCount) < moduleQuota;
      let stripeSubscriptionItemId = null;

      // Get module price
      const modulePrice = modulePricing[moduleId]?.[currency];
      if (!modulePrice) {
        console.warn(`No pricing found for module ${moduleId} in currency ${currency}`);
        continue;
      }

      // Only add to Stripe if it's a paid module and the company has an active paid subscription
      if (!isIncluded && hasActivePaidSubscription) {
        // Create a product for this module (Stripe will handle duplicates)
        const product = await stripe.products.create({
          name: `${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} Module`,
          metadata: { module_id: moduleId },
        });

        // Create price for the product
        const price = await stripe.prices.create({
          product: product.id,
          currency: currency,
          unit_amount: Math.round(modulePrice * (currency === 'ugx' ? 1 : 100)),
          recurring: { interval: 'month' },
        });

        // Add to Stripe subscription
        const subscriptionItem = await stripe.subscriptionItems.create({
          subscription: settingsRow.stripe_subscription_id!,
          price: price.id,
          proration_behavior: 'create_prorations',
        });

        stripeSubscriptionItemId = subscriptionItem.id;
      }

      // Add to database
      const newModule = await db.query(
        `INSERT INTO subscription_modules (
           company_id, module_id, monthly_price, currency,
           is_active, is_trial_module, is_included, stripe_subscription_item_id
         )
         VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7)
         RETURNING *`,
        [
          profileRow.company_id,
          moduleId,
          modulePrice,
          currency.toUpperCase(),
          isTrialActive,
          isIncluded,
          stripeSubscriptionItemId,
        ]
      );

      if (newModule.rowCount > 0) {
        addedModules.push(newModule.rows[0]);
        modulesAddedCount++;
      }
    }

    const includedModulesAdded = addedModules.filter(m => m.is_included).length;
    const paidModulesAdded = addedModules.filter(m => !m.is_included && !m.is_trial_module).length;

    return NextResponse.json({
      success: true,
      added_modules: addedModules,
      message: `${addedModules.length} module(s) added successfully`,
      breakdown: {
        included: includedModulesAdded,
        paid: paidModulesAdded,
        remainingQuota: Math.max(0, moduleQuota - (currentIncludedCount + includedModulesAdded)),
      },
    });
  } catch (error) {
    console.error('Error adding modules:', error);
    return NextResponse.json(
      { error: 'Failed to add modules' },
      { status: 500 }
    );
  }
}
