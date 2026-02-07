import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getPlanPriceId, getModulePriceId } from '@/lib/stripe-config';
import { getStripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const stripe = await getStripe();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const {
      plan_tier,
      billing_period,
      module_ids = [],
      currency = 'USD',
    } = await request.json();

    // Get current user from session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const companyId = profile.company_id;

    // Get or create Stripe customer
    const { data: settings } = await supabase
      .from('company_settings')
      .select('stripe_customer_id')
      .eq('company_id', companyId)
      .single();

    let customerId = settings?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          company_id: companyId,
          user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await supabase
        .from('company_settings')
        .update({ stripe_customer_id: customerId })
        .eq('company_id', companyId);
    }

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Add base plan
    const planPriceId = getPlanPriceId(
      plan_tier,
      billing_period,
      currency as 'USD' | 'EUR' | 'GBP' | 'UGX'
    );

    lineItems.push({
      price: planPriceId,
      quantity: 1,
    });

    // Add modules
    for (const moduleId of module_ids) {
      const modulePriceId = getModulePriceId(
        moduleId,
        currency as 'USD' | 'EUR' | 'GBP' | 'UGX'
      );

      lineItems.push({
        price: modulePriceId,
        quantity: 1,
      });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/upgrade`,
      metadata: {
        company_id: companyId,
        plan_tier,
        billing_period,
        module_ids: JSON.stringify(module_ids),
        currency,
      },
      subscription_data: {
        metadata: {
          company_id: companyId,
          plan_tier,
          billing_period,
        },
        trial_period_days: 0, // No trial here, we handle it ourselves
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
