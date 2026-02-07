import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    const body = await request.json();
    const { module_ids } = body;

    if (!module_ids || !Array.isArray(module_ids) || module_ids.length === 0) {
      return NextResponse.json({ error: 'Module IDs required' }, { status: 400 });
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company and check permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (profile.role !== 'owner' && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get company settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('stripe_subscription_id, subscription_status, currency')
      .eq('company_id', profile.company_id)
      .single();

    if (!settings?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    if (settings.subscription_status === 'trial') {
      return NextResponse.json({ error: 'Cannot add modules during trial' }, { status: 400 });
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

    const currency = (settings.currency || 'usd').toLowerCase();
    const addedModules: any[] = [];

    const stripe = await getStripe();

    // Add each module to Stripe subscription
    for (const moduleId of module_ids) {
      // Check if module already exists
      const { data: existing } = await supabase
        .from('subscription_modules')
        .select('id')
        .eq('company_id', profile.company_id)
        .eq('module_id', moduleId)
        .eq('is_active', true)
        .single();

      if (existing) {
        continue; // Skip if already active
      }

      // Get module price
      const modulePrice = modulePricing[moduleId]?.[currency];
      if (!modulePrice) {
        console.warn(`No pricing found for module ${moduleId} in currency ${currency}`);
        continue;
      }

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
        subscription: settings.stripe_subscription_id,
        price: price.id,
        proration_behavior: 'create_prorations',
      });

      // Add to database
      const { data: newModule } = await supabaseAdmin
        .from('subscription_modules')
        .insert({
          company_id: profile.company_id,
          module_id: moduleId,
          monthly_price: modulePrice,
          currency: currency.toUpperCase(),
          is_active: true,
          is_trial_module: false,
          stripe_subscription_item_id: subscriptionItem.id,
        })
        .select()
        .single();

      if (newModule) {
        addedModules.push(newModule);
      }
    }

    return NextResponse.json({
      success: true,
      added_modules: addedModules,
      message: `${addedModules.length} module(s) added successfully`,
    });
  } catch (error) {
    console.error('Error adding modules:', error);
    return NextResponse.json(
      { error: 'Failed to add modules' },
      { status: 500 }
    );
  }
}
