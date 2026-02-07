// Script to create Stripe products and prices
// Run this once to set up your Stripe account with all products and prices
// Usage: node scripts/setup-stripe-products.js

import Stripe from 'stripe';
import { getPrice, type Region } from '../src/lib/regional-pricing.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

// Regional pricing from our existing system
const REGIONS: Region[] = ['AFRICA', 'ASIA', 'EU', 'GB', 'US', 'DEFAULT'];

async function setupProducts() {
  console.log('🚀 Setting up Stripe products and prices...\n');

  // 1. Create Base Plan Products
  console.log('📦 Creating plan products...');
  
  const starterProduct = await stripe.products.create({
    name: 'BlueOx Starter Plan',
    description: 'Core accounting features for small teams (3 users, 100 transactions/month)',
    metadata: { plan_tier: 'starter' },
  });
  console.log(`✅ Created Starter product: ${starterProduct.id}`);

  const professionalProduct = await stripe.products.create({
    name: 'BlueOx Professional Plan',
    description: 'Advanced features with unlimited modules (10 users, 1000 transactions/month)',
    metadata: { plan_tier: 'professional' },
  });
  console.log(`✅ Created Professional product: ${professionalProduct.id}`);

  const enterpriseProduct = await stripe.products.create({
    name: 'BlueOx Enterprise Plan',
    description: 'Full-scale business management with custom features (unlimited users)',
    metadata: { plan_tier: 'enterprise' },
  });
  console.log(`✅ Created Enterprise product: ${enterpriseProduct.id}\n`);

  // 2. Create Module Products
  console.log('📦 Creating module products...');
  
  const moduleProducts = {
    tours: await stripe.products.create({
      name: 'Tours & Safari Module',
      description: 'Tour packages, bookings, itineraries, and guide management',
      metadata: { module_id: 'tours' },
    }),
    fleet: await stripe.products.create({
      name: 'Fleet Management Module',
      description: 'Vehicle tracking, maintenance scheduling, and fuel management',
      metadata: { module_id: 'fleet' },
    }),
    hotels: await stripe.products.create({
      name: 'Hotel Management Module',
      description: 'Room reservations, occupancy tracking, and pricing',
      metadata: { module_id: 'hotels' },
    }),
    cafe: await stripe.products.create({
      name: 'Retail & Restaurant Module',
      description: 'POS system, menu management, and sales tracking',
      metadata: { module_id: 'cafe' },
    }),
    security: await stripe.products.create({
      name: 'Security Services Module',
      description: 'Guard scheduling, site management, and incident reports',
      metadata: { module_id: 'security' },
    }),
    inventory: await stripe.products.create({
      name: 'Inventory & Assets Module',
      description: 'Multi-location inventory, depreciation, and asset tracking',
      metadata: { module_id: 'inventory' },
    }),
  };

  Object.entries(moduleProducts).forEach(([id, product]) => {
    console.log(`✅ Created ${id} module: ${product.id}`);
  });
  console.log('');

  // 3. Create Prices for Each Plan
  console.log('💰 Creating plan prices...\n');

  const currencyMap: Record<Region, string> = {
    AFRICA: 'ugx',
    ASIA: 'usd',
    EU: 'eur',
    GB: 'gbp',
    US: 'usd',
    DEFAULT: 'usd',
  };

  for (const region of REGIONS) {
    const currency = currencyMap[region];
    console.log(`Creating prices for region: ${region} (${currency.toUpperCase()})`);

    // Starter prices
    const starterPrice = getPrice('starter', region);

    await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: Math.round(starterPrice.monthly * (currency === 'ugx' ? 1 : 100)),
      currency: currency,
      recurring: { interval: 'month' },
      metadata: { plan_tier: 'starter', region, period: 'monthly' },
    });

    await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: Math.round(starterPrice.annually * 12 * (currency === 'ugx' ? 1 : 100)),
      currency: currency,
      recurring: { interval: 'year' },
      metadata: { plan_tier: 'starter', region, period: 'annual' },
    });

    // Professional prices
    const professionalPrice = getPrice('professional', region);

    await stripe.prices.create({
      product: professionalProduct.id,
      unit_amount: Math.round(professionalPrice.monthly * (currency === 'ugx' ? 1 : 100)),
      currency: currency,
      recurring: { interval: 'month' },
      metadata: { plan_tier: 'professional', region, period: 'monthly' },
    });

    await stripe.prices.create({
      product: professionalProduct.id,
      unit_amount: Math.round(professionalPrice.annually * 12 * (currency === 'ugx' ? 1 : 100)),
      currency: currency,
      recurring: { interval: 'year' },
      metadata: { plan_tier: 'professional', region, period: 'annual' },
    });

    // Enterprise prices
    const enterprisePrice = getPrice('enterprise', region);

    await stripe.prices.create({
      product: enterpriseProduct.id,
      unit_amount: Math.round(enterprisePrice.monthly * (currency === 'ugx' ? 1 : 100)),
      currency: currency,
      recurring: { interval: 'month' },
      metadata: { plan_tier: 'enterprise', region, period: 'monthly' },
    });

    await stripe.prices.create({
      product: enterpriseProduct.id,
      unit_amount: Math.round(enterprisePrice.annually * 12 * (currency === 'ugx' ? 1 : 100)),
      currency: currency,
      recurring: { interval: 'year' },
      metadata: { plan_tier: 'enterprise', region, period: 'annual' },
    });

    console.log(`  ✅ Created 6 prices for ${region}`);
  }

  console.log('\n💰 Creating module prices...\n');

  // Module pricing by currency
  const modulePricing = {
    tours: { usd: 39, eur: 35, gbp: 31, ugx: 145000 },
    fleet: { usd: 35, eur: 32, gbp: 28, ugx: 130000 },
    hotels: { usd: 45, eur: 41, gbp: 36, ugx: 167000 },
    cafe: { usd: 35, eur: 32, gbp: 28, ugx: 130000 },
    security: { usd: 29, eur: 26, gbp: 23, ugx: 108000 },
    inventory: { usd: 39, eur: 35, gbp: 31, ugx: 145000 },
  };

  for (const [moduleId, product] of Object.entries(moduleProducts)) {
    console.log(`Creating prices for ${moduleId} module...`);
    
    const pricing = modulePricing[moduleId as keyof typeof modulePricing];

    for (const [currency, amount] of Object.entries(pricing)) {
      await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(amount * (currency === 'ugx' ? 1 : 100)),
        currency: currency,
        recurring: { interval: 'month' },
        metadata: { module_id: moduleId, currency },
      });
    }

    console.log(`  ✅ Created 4 prices for ${moduleId}`);
  }

  console.log('\n✅ All products and prices created successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Update src/lib/stripe-config.ts with actual product and price IDs');
  console.log('2. Copy IDs from Stripe Dashboard → Products');
  console.log('3. Test checkout flow with test mode');
}

setupProducts().catch(console.error);
