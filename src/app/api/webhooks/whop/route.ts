import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';
import { getWhop, unwrapWhopWebhook } from '@/lib/whop';
import { mapCountryToRegion } from '@/lib/regional-pricing';


export async function POST(request: NextRequest) {
  const bodyText = await request.text();
  const headers = Object.fromEntries(request.headers);

  try {
    const whop = await getWhop();
    const webhook = await unwrapWhopWebhook(bodyText, headers as any);

    const type = webhook.type;
    const data = webhook.data;

    switch (type) {
      case 'payment.succeeded':
        await handlePaymentSucceeded(data);
        break;
      case 'payment.failed':
        await handlePaymentFailed(data);
        break;
      case 'membership.activated':
        await handleMembershipActivated(data);
        break;
      case 'membership.cancelled':
        await handleMembershipCancelled(data);
        break;
      default:
        console.log('Unhandled whop webhook', type);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Whop webhook error:', err.message || err);
    return NextResponse.json({ error: err.message || 'Webhook error' }, { status: 500 });
  }
}

async function handlePaymentSucceeded(payment: any) {
  const db = getDbProvider();
  const metadata = payment.metadata || {};
  const companyId = metadata.company_id;
  const planTier = metadata.plan_tier;
  const billingPeriod = metadata.billing_period;
  const moduleIds = JSON.parse(metadata.module_ids || '[]');
  const displayRegion = metadata.display_region;

  const billingCountry = payment.billing_details?.address?.country;
  const actualRegion = billingCountry ? mapCountryToRegion(billingCountry) : 'DEFAULT';

  if (actualRegion !== displayRegion) {
    // Keep fraud logging best-effort so payments continue even if optional table is absent.
    try {
      await db.query(
        `INSERT INTO fraud_attempts (
           payment_id,
           company_id,
           expected_region,
           actual_region,
           amount,
           billing_country,
           created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [payment.id, companyId, displayRegion || null, actualRegion, payment.amount || 0, billingCountry || null]
      );
    } catch (error) {
      console.warn('Failed to store fraud_attempts record:', error);
    }
  }

  // Create subscription record
  await db.query(
    `INSERT INTO subscriptions (
       company_id,
       plan_tier,
       billing_period,
       status,
       current_period_start,
       current_period_end,
       base_price_amount,
       currency,
       updated_at
     ) VALUES (
       $1, $2, $3, 'active', NOW(), $4, $5, $6, NOW()
     )`,
    [
      companyId,
      planTier,
      billingPeriod,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      (payment.amount || 0) / 100,
      payment.currency || metadata.currency || 'USD',
    ]
  );

  // Deactivate trial modules
  await db.query(
    `UPDATE subscription_modules
     SET is_active = false,
         removed_at = NOW(),
         updated_at = NOW()
     WHERE company_id = $1
       AND is_trial_module = true
       AND is_active = true`,
    [companyId]
  );

  // Activate paid modules
  for (const moduleId of moduleIds) {
    await db.query(
      `INSERT INTO subscription_modules (
         company_id,
         module_id,
         is_active,
         monthly_price,
         currency,
         is_trial_module,
         is_included,
         added_at,
         updated_at
       ) VALUES (
         $1, $2, true, 0, $3, false, false, NOW(), NOW()
       )
       ON CONFLICT (company_id, module_id, is_active)
       DO NOTHING`,
      [companyId, moduleId, payment.currency || 'USD']
    );
  }

  await db.query(
    `UPDATE company_settings
     SET subscription_status = 'active',
         plan_tier = $2,
         updated_at = NOW()
     WHERE company_id = $1`,
    [companyId, planTier]
  );

  await db.query(
    `INSERT INTO billing_history (
       company_id,
       invoice_number,
       amount,
       currency,
       status,
       paid_at,
       created_at
     ) VALUES (
       $1, $2, $3, $4, 'succeeded', NOW(), NOW()
     )`,
    [companyId, payment.id, (payment.amount || 0) / 100, payment.currency || 'USD']
  );
}

async function handlePaymentFailed(payment: any) {
  const db = getDbProvider();
  const companyId = payment.metadata?.company_id;
  if (!companyId) return;
  await db.query(
    `UPDATE subscriptions
     SET status = 'past_due',
         updated_at = NOW()
     WHERE company_id = $1`,
    [companyId]
  );
  await db.query(
    `INSERT INTO billing_history (
       company_id,
       invoice_number,
       amount,
       currency,
       status,
       failed_at,
       created_at
     ) VALUES (
       $1, $2, $3, $4, 'failed', NOW(), NOW()
     )`,
    [companyId, payment.id, (payment.amount || 0) / 100, payment.currency || 'USD']
  );
}

async function handleMembershipActivated(data: any) {
  // Optional: map membership activation to subscription in DB
}

async function handleMembershipCancelled(data: any) {
  const db = getDbProvider();
  const companyId = data.metadata?.company_id;
  if (!companyId) return;
  await db.query(
    `UPDATE subscriptions
     SET status = 'cancelled',
         cancelled_at = NOW(),
         updated_at = NOW()
     WHERE company_id = $1`,
    [companyId]
  );
  await db.query(
    `UPDATE subscription_modules
     SET is_active = false,
         removed_at = NOW(),
         updated_at = NOW()
     WHERE company_id = $1
       AND is_trial_module = false
       AND is_active = true`,
    [companyId]
  );
}
