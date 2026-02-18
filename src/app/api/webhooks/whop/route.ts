import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/get-service-client';
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
  const supabase = await getServiceClient();
  const metadata = payment.metadata || {};
  const companyId = metadata.company_id;
  const planTier = metadata.plan_tier;
  const billingPeriod = metadata.billing_period;
  const moduleIds = JSON.parse(metadata.module_ids || '[]');
  const displayRegion = metadata.display_region;

  const billingCountry = payment.billing_details?.address?.country;
  const actualRegion = billingCountry ? mapCountryToRegion(billingCountry) : 'DEFAULT';

  if (actualRegion !== displayRegion) {
    await supabase.from('fraud_attempts').insert({
      payment_id: payment.id,
      company_id: companyId,
      expected_region: displayRegion,
      actual_region: actualRegion,
      amount: payment.amount,
      billing_country: billingCountry,
      created_at: new Date().toISOString(),
    });
  }

  // Create subscription record
  await supabase.from('subscriptions').insert({
    company_id: companyId,
    plan_tier: planTier,
    billing_period: billingPeriod,
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    base_price_amount: (payment.amount || 0) / 100,
    currency: payment.currency || metadata.currency || 'USD',
    whop_payment_id: payment.id,
    actual_billing_region: actualRegion,
  });

  // Deactivate trial modules
  await supabase
    .from('subscription_modules')
    .update({ is_active: false })
    .eq('company_id', companyId)
    .eq('is_trial_module', true);

  // Activate paid modules
  for (const moduleId of moduleIds) {
    await supabase.from('subscription_modules').insert({
      company_id: companyId,
      module_id: moduleId,
      is_active: true,
      monthly_price: 0,
      currency: payment.currency || 'USD',
      is_trial_module: false,
    });
  }

  await supabase
    .from('company_settings')
    .update({ subscription_status: 'active', plan_tier: planTier })
    .eq('company_id', companyId);

  await supabase.from('billing_history').insert({
    company_id: companyId,
    invoice_number: payment.id,
    amount: (payment.amount || 0) / 100,
    currency: payment.currency || 'USD',
    status: 'succeeded',
    paid_at: new Date().toISOString(),
    billing_region: actualRegion,
  });
}

async function handlePaymentFailed(payment: any) {
  const supabase = await getServiceClient();
  const companyId = payment.metadata?.company_id;
  if (!companyId) return;
  await supabase.from('subscriptions').update({ status: 'past_due' }).eq('company_id', companyId);
  await supabase.from('billing_history').insert({
    company_id: companyId,
    invoice_number: payment.id,
    amount: (payment.amount || 0) / 100,
    currency: payment.currency || 'USD',
    status: 'failed',
    paid_at: new Date().toISOString(),
  });
}

async function handleMembershipActivated(data: any) {
  // Optional: map membership activation to subscription in DB
}

async function handleMembershipCancelled(data: any) {
  const supabase = await getServiceClient();
  const companyId = data.metadata?.company_id;
  if (!companyId) return;
  await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('company_id', companyId);
  await supabase.from('subscription_modules').update({ is_active: false }).eq('company_id', companyId).eq('is_trial_module', false);
}
