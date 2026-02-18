import { regionalPricing, MODULE_PRICING } from '../src/lib/regional-pricing';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://api.whop.com/api/v1';

async function createProduct(apiKey: string, companyId: string, name: string, description?: string) {
  const body = {
    title: name,
    description: description || name,
  };
  
  const res = await fetch(`${BASE_URL}/companies/${companyId}/products`, {
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

async function createPlan(apiKey: string, productId: string, payload: any) {
  const body = payload;
  
  const res = await fetch(`${BASE_URL}/products/${productId}/plans`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${apiKey}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error(`  Payload:`, JSON.stringify(body, null, 2));
    console.error(`  Error: ${res.status}`);
    throw new Error(`Failed to create plan`);
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

  console.log('Creating base product for plans...');
  const baseProduct = await createProduct(apiKey, companyId, 'Base Plans', 'Subscription tiers');

  // Create monthly and annual plans for each tier/region
  for (const tier of tiers) {
    // Monthly plans
    for (const region of regions) {
      const monthlyData = (regionalPricing as any)[region]?.[tier]?.monthly;
      if (!monthlyData) continue;
      const monthlyPrice = typeof monthlyData === 'object' ? monthlyData.max : monthlyData;
      const planName = `${tier}-${region}-monthly`;
      
      try {
        const plan = await createPlan(apiKey, baseProduct.id, {
          name: planName,
          price: monthlyPrice,
          billing_period: 'month',
        });
        console.log('✓ Created plan', planName, `(ID: ${plan.id})`);
        results.plans[`${tier}-monthly`] = results.plans[`${tier}-monthly`] || {};
        results.plans[`${tier}-monthly`][region] = plan.id;
      } catch (e) {
        console.error(`Failed to create ${planName}:`, e);
      }
    }

    // Annual plans
    for (const region of regions) {
      const annualPrice = (regionalPricing as any)[region]?.[tier]?.annual;
      if (!annualPrice) continue;
      const planName = `${tier}-${region}-annual`;
      
      try {
        const plan = await createPlan(apiKey, baseProduct.id, {
          name: planName,
          price: annualPrice,
          billing_period: 'year',
        });
        console.log('✓ Created plan', planName, `(ID: ${plan.id})`);
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
      
      const planName = `${moduleId}-${region}`;
      try {
        const plan = await createPlan(apiKey, moduleProduct.id, {
          name: planName,
          price: price,
          billing_period: 'month',
        });
        console.log(`  ✓ Created ${planName} (ID: ${plan.id})`);
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
export const WHOP_PLAN_IDS: Record<string, Record<Region, string>> = ${JSON.stringify(planIds, null, 2)};

export const WHOP_MODULE_IDS: Record<string, Record<Region, string>> = ${JSON.stringify(moduleIds, null, 2)};

export function getPlanId(planTier: string, billingPeriod: string, region: Region): string {
  const key = \`\${planTier}-\${billingPeriod}\`;
  const id = (WHOP_PLAN_IDS as any)[key]?.[region];
  if (!id) throw new Error(\`No Whop plan id for \${key} in \${region}\`);
  return id;
}

export function getModulePlanId(moduleId: string, region: Region): string {
  const id = (WHOP_MODULE_IDS as any)[moduleId]?.[region];
  if (!id) throw new Error(\`No Whop module plan id for \${moduleId} in \${region}\`);
  return id;
}
`;

  fs.writeFileSync(configPath, updatedConfig);
  console.log('Updated whop-config.ts with generated IDs');

  console.log('✅ Whop product setup complete!');
}

main().catch((err)=>{ console.error(err); process.exit(1); });
