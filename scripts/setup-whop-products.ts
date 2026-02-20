import { regionalPricing, MODULE_PRICING } from '../src/lib/regional-pricing';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://api.whop.com/api/v1';

// Exchange rates for currency conversion to USD
// Using approximate rates - update these as needed
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.10,  // 1 EUR ≈ $1.10 USD
  GBP: 1.27,  // 1 GBP ≈ $1.27 USD
  UGX: 0.00027, // 1 UGX ≈ $0.00027 USD (3700 UGX ≈ $1)
};

/**
 * Convert price from local currency to USD
 * Detects currency based on the price value and currencySymbol
 */
function convertToUSD(price: number, currencySymbol: string): number {
  let rate = 1.0;
  
  if (currencySymbol === '€') {
    rate = EXCHANGE_RATES.EUR;
  } else if (currencySymbol === '£') {
    rate = EXCHANGE_RATES.GBP;
  } else if (currencySymbol === 'UGX') {
    rate = EXCHANGE_RATES.UGX;
  }
  
  const usdPrice = price * rate;
  // Round to 2 decimal places
  return Math.round(usdPrice * 100) / 100;
}

async function createProduct(apiKey: string, companyId: string, name: string, description?: string) {
  const body = {
    company_id: companyId,
    title: name,
    description: description || name,
  };
  
  const res = await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${apiKey}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error(`  Error: ${res.status} - ${text.substring(0, 300)}`);
    throw new Error(`Failed to create product ${name}: ${res.status}`);
  }
  
  const data = await res.json();
  console.log(`  ✓ Created product "${name}" (ID: ${data.id})`);
  return data;
}

async function createPlan(apiKey: string, companyId: string, productId: string, payload: any) {
  const body = {
    company_id: companyId,
    access_pass_id: productId,
    plan_type: 'renewal',
    initial_price: 0,  // No upfront fee – only charge renewal (avoids double price at checkout)
    renewal_price: payload.price,
    billing_period: payload.billing_period === 'month' ? 30 : 365,
    currency: 'usd',  // Whop requires USD for pricing
  };
  
  const res = await fetch(`${BASE_URL}/plans`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${apiKey}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error(`  Error: ${res.status} - ${text.substring(0, 300)}`);
    console.error(`  Payload:`, JSON.stringify(body, null, 2));
    throw new Error(`Failed to create plan: ${res.status}`);
  }
  
  return res.json();
}

async function main() {
  const apiKey = process.env.WHOP_API_KEY;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!apiKey || !companyId) {
    console.error('WHOP_API_KEY and WHOP_COMPANY_ID must be set');
    process.exit(1);
  }

  const regions = ['AFRICA','ASIA','EU','GB','US','DEFAULT'] as const;
  const tiers = ['starter','professional','enterprise'] as const;

  const results: any = { plans: {}, modules: {} };
  const plansNeedingContactSupport: string[] = [];  // Track plans exceeding $2500 limit

  console.log('Creating base product for plans...');
  const baseProduct = await createProduct(apiKey, companyId, 'Base Plans', 'Subscription tiers');

  // Create monthly and annual plans for each tier/region
  for (const tier of tiers) {
    // Monthly plans
    for (const region of regions) {
      const regionData = (regionalPricing as any)[region]?.[tier];
      if (!regionData) continue;
      const monthlyData = regionData.monthly;
      if (!monthlyData) continue;
      
      const monthlyPrice = typeof monthlyData === 'object' ? monthlyData.max : monthlyData;
      const currencySymbol = regionData.currencySymbol;
      const usdPrice = convertToUSD(monthlyPrice, currencySymbol);
      const planName = `${tier}-${region}-monthly`;
      
      try {
        const plan = await createPlan(apiKey, companyId, baseProduct.id, {
          name: planName,
          price: usdPrice,
          billing_period: 'month',
        });
        console.log(`✓ Created plan ${planName} (${monthlyPrice} ${currencySymbol} = $${usdPrice} USD) (ID: ${plan.id})`);
        results.plans[`${tier}-monthly`] = results.plans[`${tier}-monthly`] || {};
        results.plans[`${tier}-monthly`][region] = plan.id;
      } catch (e) {
        console.error(`Failed to create ${planName}:`, e);
      }
    }

    // Annual plans
    for (const region of regions) {
      const regionData = (regionalPricing as any)[region]?.[tier];
      if (!regionData) continue;
      const annualPrice = regionData.annual;
      if (!annualPrice) continue;
      
      const currencySymbol = regionData.currencySymbol;
      const usdPrice = convertToUSD(annualPrice, currencySymbol);
      const planName = `${tier}-${region}-annual`;
      
      // Whop has a $2500 limit - for plans above this, direct users to contact support
      if (usdPrice > 2500) {
        console.log(`⚠️  SKIPPED ${planName} ($${usdPrice} USD) - Exceeds Whop's $2500 limit`);
        console.log(`   → Users should contact us via WhatsApp or email for custom pricing`);
        plansNeedingContactSupport.push(`${planName} ($${usdPrice} USD)`);
        continue;  // Skip creating this plan
      }
      
      try {
        const plan = await createPlan(apiKey, companyId, baseProduct.id, {
          name: planName,
          price: usdPrice,
          billing_period: 'year',
        });
        console.log(`✓ Created plan ${planName} (${annualPrice} ${currencySymbol} = $${usdPrice} USD) (ID: ${plan.id})`);
        results.plans[`${tier}-annual`] = results.plans[`${tier}-annual`] || {};
        results.plans[`${tier}-annual`][region] = plan.id;
      } catch (e) {
        console.error(`Failed to create ${planName}:`, e);
      }
    }
  }

  // Modules
  const moduleList = ['tours','fleet','hotels','cafe','inventory','payroll'];
  for (const moduleId of moduleList) {
    console.log(`Creating product for module: ${moduleId}`);
    const moduleProduct = await createProduct(apiKey, companyId, `${moduleId} module`, `Module: ${moduleId}`);
    results.modules[moduleId] = {};
    
    for (const region of regions) {
      const price = (MODULE_PRICING as any)[region]?.[moduleId];
      if (!price || typeof price !== 'number') continue;
      
      // Get currency from region's starter tier (all tiers in same region have same currency)
      const currencySymbol = (regionalPricing as any)[region]?.starter?.currencySymbol || '$';
      const usdPrice = convertToUSD(price, currencySymbol);
      const planName = `${moduleId}-${region}`;
      
      try {
        const plan = await createPlan(apiKey, companyId, moduleProduct.id, {
          name: planName,
          price: usdPrice,
          billing_period: 'month',
        });
        console.log(`  ✓ Created ${planName} (${price} ${currencySymbol} = $${usdPrice} USD) (ID: ${plan.id})`);
        results.modules[moduleId][region] = plan.id;
      } catch (e) {
        console.error(`Failed to create ${planName}:`, e);
      }
    }
  }

  // Write generated IDs to files
  const outPath = path.join(__dirname, '..', 'src', 'lib', 'whop-config.generated.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log('Wrote generated IDs to', outPath);

  // Transform results for config export
  const planIds: Record<string, Record<string, string>> = {};
  const moduleIds: Record<string, Record<string, string>> = {};

  for (const [internalName, regionMap] of Object.entries(results.plans)) {
    planIds[internalName] = regionMap as Record<string, string>;
  }

  for (const [moduleId, regionMap] of Object.entries(results.modules)) {
    moduleIds[moduleId] = regionMap as Record<string, string>;
  }

  // Create the new config
  const configPath = path.join(__dirname, '..', 'src', 'lib', 'whop-config.ts');
  const updatedConfig = `import { Region } from './regional-pricing';

// Generated Whop plan and module IDs (created ${new Date().toISOString()})
// Note: Some plans may be missing if they exceed Whop's $2500 transaction limit
export const WHOP_PLAN_IDS: Record<string, Partial<Record<Region, string>>> = ${JSON.stringify(planIds, null, 2)};

export const WHOP_MODULE_IDS: Record<string, Partial<Record<Region, string>>> = ${JSON.stringify(moduleIds, null, 2)};

export function getPlanId(planTier: string, billingPeriod: string, region: Region): string | undefined {
  const key = \`\${planTier}-\${billingPeriod}\`;
  const id = (WHOP_PLAN_IDS as any)[key]?.[region];
  return id;
}

export function getModulePlanId(moduleId: string, region: Region): string | undefined {
  const id = (WHOP_MODULE_IDS as any)[moduleId]?.[region];
  return id;
}
`;

  fs.writeFileSync(configPath, updatedConfig);
  console.log('Updated whop-config.ts with generated IDs');

  console.log('\n✅ Whop product setup complete!');
  
  if (plansNeedingContactSupport.length > 0) {
    console.log('\n⚠️  PLANS REQUIRING MANUAL SETUP (Exceed $2500 limit):');
    plansNeedingContactSupport.forEach(plan => {
      console.log(`   • ${plan}`);
    });
    console.log('\nℹ️  For these high-value plans, users should contact support:');
    console.log('   📧 Email: support@blueoox.com');
    console.log('   💬 WhatsApp: +256-XXX-XXXX-XXX');
    console.log('\nOnce Whop enables higher transaction limits for your account,');
    console.log('re-run this script to create these plans automatically.');
  }
}

main().catch((err)=>{ console.error(err); process.exit(1); });
