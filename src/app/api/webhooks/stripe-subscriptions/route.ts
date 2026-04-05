import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getDbProvider } from '@/lib/provider';
import { getStripe } from '@/lib/stripe';

const WEBHOOK_SECRET = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET!;

/**
 * Stripe Webhook Handler for Subscription Events
 * Handles: checkout, subscriptions, invoices
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  const stripe = await getStripe();
  const db = getDbProvider();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`📨 Subscription webhook: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripe, db);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, stripe, db);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, db);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, db);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object as Stripe.Subscription, db);
        break;

      default:
        console.log(`ℹ️  Unhandled subscription event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error(`❌ Error handling ${event.type}:`, error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, stripe: any, db: any) {
  console.log('✅ Processing checkout.session.completed');

  const companyId = session.metadata!.company_id;
  const planTier = session.metadata!.plan_tier;
  const billingPeriod = session.metadata!.billing_period;
  const moduleIds = JSON.parse(session.metadata!.module_ids || '[]');
  const currency = session.metadata!.currency || 'USD';

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

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
       stripe_customer_id,
       stripe_subscription_id,
       updated_at
     ) VALUES (
       $1, $2, $3, 'active', $4, $5, $6, $7, $8, $9, NOW()
     )
     ON CONFLICT (stripe_subscription_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       base_price_amount = EXCLUDED.base_price_amount,
       currency = EXCLUDED.currency,
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       updated_at = NOW()`,
    [
      companyId,
      planTier,
      billingPeriod,
      new Date(subscription.current_period_start * 1000).toISOString(),
      new Date(subscription.current_period_end * 1000).toISOString(),
      (session.amount_total || 0) / 100,
      currency,
      session.customer as string,
      session.subscription as string,
    ]
  );

  // Activate modules
  if (moduleIds.length > 0) {
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

    for (const moduleId of moduleIds) {
      await db.query(
        `INSERT INTO subscription_modules (
           company_id,
           module_id,
           monthly_price,
           currency,
           is_active,
           is_trial_module,
           is_included,
           added_at,
           updated_at
         ) VALUES (
           $1, $2, $3, $4, true, false, false, NOW(), NOW()
         )
         ON CONFLICT (company_id, module_id, is_active)
         DO NOTHING`,
        [companyId, moduleId, getModulePrice(moduleId, currency), currency]
      );
    }
  }

  // Update company settings
  const maxUsers = planTier === 'starter' ? 3 : planTier === 'professional' ? 10 : 999999;

  await db.query(
    `UPDATE company_settings
     SET subscription_status = 'active',
         plan_tier = $2,
         billing_period = $3,
         current_period_start = $4,
         current_period_end = $5,
         max_users_allowed = $6,
         stripe_customer_id = $7,
         stripe_subscription_id = $8,
         updated_at = NOW()
     WHERE company_id = $1`,
    [
      companyId,
      planTier,
      billingPeriod,
      new Date(subscription.current_period_start * 1000).toISOString(),
      new Date(subscription.current_period_end * 1000).toISOString(),
      maxUsers,
      session.customer as string,
      session.subscription as string,
    ]
  );

  console.log(`✅ Subscription activated for company ${companyId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice, stripe: any, db: any) {
  console.log('✅ Processing invoice.paid');

  let companyId = invoice.subscription_details?.metadata?.company_id;
  if (!companyId && invoice.subscription) {
    const companyResult = await db.query(
      `SELECT company_id
       FROM subscriptions
       WHERE stripe_subscription_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [invoice.subscription as string]
    );
    companyId = companyResult.rows[0]?.company_id;
  }

  if (!companyId) return;

  // Save to billing history
  await db.query(
    `INSERT INTO billing_history (
       company_id,
       amount,
       currency,
       status,
       invoice_number,
       invoice_url,
       invoice_pdf_url,
       period_start,
       period_end,
       stripe_invoice_id,
       stripe_payment_intent_id,
       paid_at,
       created_at
     ) VALUES (
       $1, $2, $3, 'succeeded', $4, $5, $6, $7, $8, $9, $10, $11, NOW()
     )`,
    [
      companyId,
      invoice.amount_paid / 100,
      (invoice.currency || 'USD').toUpperCase(),
      invoice.number || null,
      invoice.hosted_invoice_url || null,
      invoice.invoice_pdf || null,
      new Date((invoice.period_start || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      new Date((invoice.period_end || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      invoice.id,
      (invoice.payment_intent as string) || null,
      invoice.status_transitions.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : new Date().toISOString(),
    ]
  );

  // Update subscription period
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

    await db.query(
      `UPDATE company_settings
       SET subscription_status = 'active',
           current_period_start = $2,
           current_period_end = $3,
           updated_at = NOW()
       WHERE company_id = $1`,
      [
        companyId,
        new Date(subscription.current_period_start * 1000).toISOString(),
        new Date(subscription.current_period_end * 1000).toISOString(),
      ]
    );
  }

  console.log(`✅ Invoice paid for company ${companyId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice, db: any) {
  console.log('⚠️  Processing invoice.payment_failed');

  let companyId = invoice.subscription_details?.metadata?.company_id;
  if (!companyId && invoice.subscription) {
    const companyResult = await db.query(
      `SELECT company_id
       FROM subscriptions
       WHERE stripe_subscription_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [invoice.subscription as string]
    );
    companyId = companyResult.rows[0]?.company_id;
  }

  if (!companyId) return;

  // Save failed payment
  await db.query(
    `INSERT INTO billing_history (
       company_id,
       amount,
       currency,
       status,
       stripe_invoice_id,
       failed_at,
       failure_reason,
       created_at
     ) VALUES (
       $1, $2, $3, 'failed', $4, NOW(), $5, NOW()
     )`,
    [
      companyId,
      invoice.amount_due / 100,
      (invoice.currency || 'USD').toUpperCase(),
      invoice.id,
      invoice.last_finalization_error?.message || 'Payment failed',
    ]
  );

  // Update to past_due
  await db.query(
    `UPDATE company_settings
     SET subscription_status = 'past_due', updated_at = NOW()
     WHERE company_id = $1`,
    [companyId]
  );

  console.log(`⚠️  Payment failed for company ${companyId}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, db: any) {
  console.log('🔄 Processing customer.subscription.updated');

  const companyId = subscription.metadata.company_id;
  if (!companyId) return;

  const status = subscription.status === 'active' ? 'active' :
                 subscription.status === 'past_due' ? 'past_due' :
                 subscription.status === 'canceled' ? 'cancelled' : 'expired';

  await db.query(
    `UPDATE company_settings
     SET subscription_status = $2,
         current_period_start = $3,
         current_period_end = $4,
         updated_at = NOW()
     WHERE company_id = $1`,
    [
      companyId,
      status,
      new Date(subscription.current_period_start * 1000).toISOString(),
      new Date(subscription.current_period_end * 1000).toISOString(),
    ]
  );

  if (subscription.id) {
    await db.query(
      `UPDATE subscriptions
       SET status = $2,
           current_period_start = $3,
           current_period_end = $4,
           updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [
        subscription.id,
        status,
        new Date(subscription.current_period_start * 1000).toISOString(),
        new Date(subscription.current_period_end * 1000).toISOString(),
      ]
    );
  }

  console.log(`🔄 Subscription updated: ${status}`);
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription, db: any) {
  console.log('❌ Processing customer.subscription.deleted');

  const companyId = subscription.metadata.company_id;
  if (!companyId) return;

  await db.query(
    `UPDATE company_settings
     SET subscription_status = 'cancelled', updated_at = NOW()
     WHERE company_id = $1`,
    [companyId]
  );

  if (subscription.id) {
    await db.query(
      `UPDATE subscriptions
       SET status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [subscription.id]
    );
  }

  // Deactivate modules
  await db.query(
    `UPDATE subscription_modules
     SET is_active = false,
         removed_at = NOW(),
         updated_at = NOW()
     WHERE company_id = $1
       AND is_active = true`,
    [companyId]
  );

  console.log(`❌ Subscription cancelled for company ${companyId}`);
}

function getModulePrice(moduleId: string, currency: string): number {
  const prices: Record<string, Record<string, number>> = {
    tours: { USD: 39, EUR: 35, GBP: 31, UGX: 145000 },
    fleet: { USD: 35, EUR: 32, GBP: 28, UGX: 130000 },
    hotels: { USD: 45, EUR: 41, GBP: 36, UGX: 167000 },
    cafe: { USD: 35, EUR: 32, GBP: 28, UGX: 130000 },
    security: { USD: 29, EUR: 26, GBP: 23, UGX: 108000 },
    inventory: { USD: 39, EUR: 35, GBP: 31, UGX: 145000 },
  };

  return prices[moduleId]?.[currency.toUpperCase()] || 0;
}
