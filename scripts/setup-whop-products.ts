import { regionalPricing, MODULE_PRICING } from '../src/lib/regional-pricing';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://api.whop.com/api/v1';

async function createProduct(apiKey: string, companyId: string, name: string, description?: string) {
  const body = { company_id: companyId, title: name, description };
  const res = await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create product ${name}: ${res.status} ${text.substring(0, 200)}`);
  }
  const data = await res.json();
  console.log(`  ✓ Created product "${name}" (ID: ${data.id})`);
  return data;
}

async function createPlan(apiKey: string, companyId: string, productId: string, payload: any) {
  const body = { company_id: companyId, product_id: productId, ...payload };
  console.log(`  Sending plan request:`, JSON.stringify(body, null, 2));
  const res = await fetch(`${BASE_URL}/plans`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`  Error response: ${text.substring(0, 200)}`);
    throw new Error(`Failed to create plan: ${res.status} ${text}`);
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
      const price = (regionalPricing as any)[region]?.[tier]?.monthly;
      if (!price) continue;
      const internalName = `${tier}-${region}-monthly`;
      const plan = await createPlan(apiKey, companyId, baseProduct.id, {
        internal_name: internalName,
        initial_price: price,
        plan_type: 'renewal',
        renewal_period: 'monthly',
        visibility: 'visible',
        currency: 'USD',
      });
      console.log('✓ Created plan', internalName, `(ID: ${plan.id})`);
      results.plans[`${tier}-monthly`] = results.plans[`${tier}-monthly`] || {};
      results.plans[`${tier}-monthly`][region] = plan.id;
    }

    // Annual plans
    for (const region of regions) {
      const price = (regionalPricing as any)[region]?.[tier]?.annually;
      if (!price) continue;
      const internalName = `${tier}-${region}-annual`;
      const plan = await createPlan(apiKey, companyId, baseProduct.id, {
        internal_name: internalName,
        initial_price: price,
        plan_type: 'renewal',
        renewal_period: 'yearly',
        visibility: 'visible',
        currency: 'USD',
      });
      console.log('✓ Created plan', internalName, `(ID: ${plan.id})`);
      results.plans[`${tier}-annual`] = results.plans[`${tier}-annual`] || {};
      results.plans[`${tier}-annual`][region] = plan.id;
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
      if (!price) continue;
      const internalName = `${moduleId}-${region}`;
      const plan = await createPlan(apiKey, companyId, moduleProduct.id, {
        internal_name: internalName,
        initial_price: price,
        plan_type: 'renewal',
        renewal_period: 'monthly',
        visibility: 'visible',
        currency: 'USD',
      });
      console.log(`  ✓ Created ${internalName} (ID: ${plan.id})`);
      results.modules[moduleId][region] = plan.id;
    }
  }

  // Write generated IDs to a JSON file and update whop-config.ts
  const outPath = path.join(__dirname, '..', 'src', 'lib', 'whop-config.generated.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log('Wrote generated IDs to', outPath);

  // Transform results into config format
  const planIds: Record<string, Record<string, string>> = {};
  const moduleIds: Record<string, Record<string, string>> = {};

  // Reorganize plans by tier-period
  for (const [internalName, regionMap] of Object.entries(results.plans)) {
    planIds[internalName] = regionMap as Record<string, string>;
  }

  // Reorganize modules by module name
  for (const [moduleId, regionMap] of Object.entries(results.modules)) {
    moduleIds[moduleId] = regionMap as Record<string, string>;
  }

  // Update src/lib/whop-config.ts with generated IDs
  const configPath = path.join(__dirname, '..', 'src', 'lib', 'whop-config.ts');
  const configContent = fs.readFileSync(configPath, 'utf8');

  // Remove any existing GENERATED sections
  const lines = configContent.split('\n');
  const cleanedLines = lines.filter(line => !line.includes('WHOP_PLAN_IDS_GENERATED') && !line.includes('WHOP_MODULE_IDS_GENERATED') && !line.includes('// GENERATED'));
  const cleanedConfig = cleanedLines.join('\n');

  // Create the new config with actual IDs
  const updatedConfig = `import { Region } from './regional-pricing';

// Placeholder mapping. Run \`scripts/setup-whop-products.ts\` to populate real plan IDs.
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
