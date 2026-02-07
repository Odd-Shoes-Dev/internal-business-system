import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripe, supabase);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, stripe, supabase);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, supabase);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabase);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object as Stripe.Subscription, supabase);
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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, stripe: any, supabase: any) {
  console.log('✅ Processing checkout.session.completed');

  const companyId = session.metadata!.company_id;
  const planTier = session.metadata!.plan_tier;
  const billingPeriod = session.metadata!.billing_period;
  const moduleIds = JSON.parse(session.metadata!.module_ids || '[]');
  const currency = session.metadata!.currency || 'USD';

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

  // Create subscription record
  await supabase.from('subscriptions').insert({
    company_id: companyId,
    plan_tier: planTier,
    billing_period: billingPeriod,
    status: 'active',
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    base_price_amount: session.amount_total! / 100,
    currency: currency,
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: session.subscription as string,
  });

  // Activate modules
  if (moduleIds.length > 0) {
    // Deactivate trial modules
    await supabase
      .from('subscription_modules')
      .update({ is_active: false, removed_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('is_trial_module', true);

    // Create paid modules
    const moduleRecords = moduleIds.map((moduleId: string) => ({
      company_id: companyId,
      module_id: moduleId,
      monthly_price: getModulePrice(moduleId, currency),
      currency: currency,
      is_active: true,
      is_trial_module: false,
    }));

    await supabase.from('subscription_modules').insert(moduleRecords);
  }

  // Update company settings
  const maxUsers = planTier === 'starter' ? 3 : planTier === 'professional' ? 10 : 999999;

  await supabase
    .from('company_settings')
    .update({
      subscription_status: 'active',
      plan_tier: planTier,
      billing_period: billingPeriod,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      max_users_allowed: maxUsers,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
    })
    .eq('company_id', companyId);

  console.log(`✅ Subscription activated for company ${companyId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice, stripe: any, supabase: any) {
  console.log('✅ Processing invoice.paid');

  const companyId = invoice.subscription_details?.metadata?.company_id;
  if (!companyId) return;

  // Save to billing history
  await supabase.from('billing_history').insert({
    company_id: companyId,
    amount: invoice.amount_paid / 100,
    currency: invoice.currency.toUpperCase(),
    status: 'succeeded',
    invoice_number: invoice.number,
    invoice_url: invoice.hosted_invoice_url,
    invoice_pdf_url: invoice.invoice_pdf,
    period_start: new Date(invoice.period_start * 1000).toISOString(),
    period_end: new Date(invoice.period_end * 1000).toISOString(),
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: invoice.payment_intent as string,
    paid_at: new Date(invoice.status_transitions.paid_at! * 1000).toISOString(),
  });

  // Update subscription period
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

    await supabase
      .from('company_settings')
      .update({
        subscription_status: 'active',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .eq('company_id', companyId);
  }

  console.log(`✅ Invoice paid for company ${companyId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice, supabase: any) {
  console.log('⚠️  Processing invoice.payment_failed');

  const companyId = invoice.subscription_details?.metadata?.company_id;
  if (!companyId) return;

  // Save failed payment
  await supabase.from('billing_history').insert({
    company_id: companyId,
    amount: invoice.amount_due / 100,
    currency: invoice.currency.toUpperCase(),
    status: 'failed',
    stripe_invoice_id: invoice.id,
    failed_at: new Date().toISOString(),
    failure_reason: invoice.last_finalization_error?.message || 'Payment failed',
  });

  // Update to past_due
  await supabase
    .from('company_settings')
    .update({ subscription_status: 'past_due' })
    .eq('company_id', companyId);

  console.log(`⚠️  Payment failed for company ${companyId}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabase: any) {
  console.log('🔄 Processing customer.subscription.updated');

  const companyId = subscription.metadata.company_id;
  if (!companyId) return;

  const status = subscription.status === 'active' ? 'active' :
                 subscription.status === 'past_due' ? 'past_due' :
                 subscription.status === 'canceled' ? 'cancelled' : 'expired';

  await supabase
    .from('company_settings')
    .update({
      subscription_status: status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('company_id', companyId);

  console.log(`🔄 Subscription updated: ${status}`);
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription, supabase: any) {
  console.log('❌ Processing customer.subscription.deleted');

  const companyId = subscription.metadata.company_id;
  if (!companyId) return;

  await supabase
    .from('company_settings')
    .update({ subscription_status: 'cancelled' })
    .eq('company_id', companyId);

  // Deactivate modules
  await supabase
    .from('subscription_modules')
    .update({ is_active: false, removed_at: new Date().toISOString() })
    .eq('company_id', companyId);

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
