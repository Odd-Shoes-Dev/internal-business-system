import { regionalPricing, MODULE_PRICING } from '../src/lib/regional-pricing';
import fs from 'fs';
import path from 'path';

// Dynamically import Whop SDK
let Whop: any;

async function initWhop(apiKey: string) {
  if (Whop) return;
  try {
    Whop = (await import('@whop/sdk')).default;
  } catch (e) {
    console.error('Failed to import @whop/sdk:', e);
    throw new Error('@whop/sdk is not installed or failed to import');
  }
}

async function createProduct(whop: any, companyId: string, name: string, description?: string) {
  try {
    const product = await whop.product.create({
      company_id: companyId,
      title: name,
      description: description || '',
    });
    console.log(`  ✓ Created product "${name}" (ID: ${product.id})`);
    return product;
  } catch (error: any) {
    throw new Error(`Failed to create product ${name}: ${error.message}`);
  }
}

async function createPlan(whop: any, companyId: string, productId: string, payload: any) {
  try {
    const plan = await whop.plan.create({
      company_id: companyId,
      product_id: productId,
      ...payload,
    });
    return plan;
  } catch (error: any) {
    console.error(`  Error creating plan with payload:`, JSON.stringify(payload, null, 2));
    throw new Error(`Failed to create plan: ${error.message}`);
  }
}

async function main() {
  const apiKey = process.env.WHOP_API_KEY;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!apiKey || !companyId) {
    console.error('WHOP_API_KEY and WHOP_COMPANY_ID must be set');
    process.exit(1);
  }

  await initWhop(apiKey);
  const whop = new Whop({ accessToken: apiKey });

  const regions = ['AFRICA','ASIA','EU','GB','US','DEFAULT'] as const;
  const tiers = ['starter','professional','enterprise'] as const;

  const results: any = { plans: {}, modules: {} };

  console.log('Creating base product for plans...');
  const baseProduct = await createProduct(whop, companyId, 'Base Plans', 'Subscription tiers');

  // Create monthly and annual plans for each tier/region
  for (const tier of tiers) {
    // Monthly plans
    for (const region of regions) {
      const monthlyData = (regionalPricing as any)[region]?.[tier]?.monthly;
      if (!monthlyData) continue;
      // Extract numeric price - handle both { min, max } object and plain number
      const monthlyPrice = typeof monthlyData === 'object' ? monthlyData.max : monthlyData;
      const planName = `${tier}-${region}-monthly`;
      const plan = await createPlan(whop, companyId, baseProduct.id, {
        title: planName,
        price: monthlyPrice,
        billing_period: 'monthly',
        currency: 'usd',
      });
      console.log('✓ Created plan', planName, `(ID: ${plan.id})`);
      results.plans[`${tier}-monthly`] = results.plans[`${tier}-monthly`] || {};
      results.plans[`${tier}-monthly`][region] = plan.id;
    }

    // Annual plans
    for (const region of regions) {
      const annualPrice = (regionalPricing as any)[region]?.[tier]?.annual;
      if (!annualPrice) continue;
      const planName = `${tier}-${region}-annual`;
      const plan = await createPlan(whop, companyId, baseProduct.id, {
        title: planName,
        price: annualPrice,
        billing_period: 'yearly',
        currency: 'usd',
      });
      console.log('✓ Created plan', planName, `(ID: ${plan.id})`);
      results.plans[`${tier}-annual`] = results.plans[`${tier}-annual`] || {};
      results.plans[`${tier}-annual`][region] = plan.id;
    }
  }

  // Modules
  const moduleList = ['tours','fleet','hotels','cafe','inventory','payroll'];
  for (const moduleId of moduleList) {
    console.log(`Creating product for module: ${moduleId}`);
    const moduleProduct = await createProduct(whop, companyId, `${moduleId} module`, `Module: ${moduleId}`);
    results.modules[moduleId] = {};
    for (const region of regions) {
      const price = (MODULE_PRICING as any)[region]?.[moduleId];
      if (!price) {
        console.log(`  ⚠️ No pricing for ${moduleId} in ${region}`);
        continue;
      }
      if (typeof price !== 'number') {
        console.log(`  ⚠️ Invalid price type for ${moduleId} in ${region}:`, price);
        continue;
      }
      const planName = `${moduleId}-${region}`;
      const plan = await createPlan(whop, companyId, moduleProduct.id, {
        title: planName,
        price: price,
        billing_period: 'monthly',
        currency: 'usd',
      });
      console.log(`  ✓ Created ${planName} (ID: ${plan.id})`);
      results.modules[moduleId][region] = plan.id;
    }
  }

  // Write generated IDs to a JSON file
  const outPath = path.join(__dirname, '..', 'src', 'lib', 'whop-config.generated.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log('Wrote generated IDs to', outPath);

  // Update src/lib/whop-config.ts with generated IDs
  const configPath = path.join(__dirname, '..', 'src', 'lib', 'whop-config.ts');
  const configContent = fs.readFileSync(configPath, 'utf8');

  // Remove any existing GENERATED sections
  const lines = configContent.split('\n');
  const cleanedLines = lines.filter(line => !line.includes('WHOP_PLAN_IDS_GENERATED') && !line.includes('WHOP_MODULE_IDS_GENERATED') && !line.includes('// GENERATED'));
  const cleanedConfig = cleanedLines.join('\n');

  // Transform results for config export
  const planIds: Record<string, Record<string, string>> = {};
  const moduleIds: Record<string, Record<string, string>> = {};

  for (const [internalName, regionMap] of Object.entries(results.plans)) {
    planIds[internalName] = regionMap as Record<string, string>;
  }

  for (const [moduleId, regionMap] of Object.entries(results.modules)) {
    moduleIds[moduleId] = regionMap as Record<string, string>;
  }

  // Create the new config with actual IDs
  const updatedConfig = `import { Region } from './regional-pricing';

// Generated Whop plan and module IDs
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
  console.log('Generated files:');
  console.log('  - ' + outPath);
  console.log('  - ' + configPath);
}

main().catch((err)=>{ console.error(err); process.exit(1); });
