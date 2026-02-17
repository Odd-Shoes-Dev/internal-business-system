import { regionalPricing, MODULE_PRICING } from '../src/lib/regional-pricing';

// Load Whop SDK at runtime to avoid requiring it during Next.js build
function loadWhop() {
  const req = eval('require');
  try {
    const Whop = req('@whop/sdk');
    return Whop;
  } catch (err) {
    console.error('@whop/sdk not installed. Run: npm install @whop/sdk');
    process.exit(1);
  }
}

async function main() {
  const apiKey = process.env.WHOP_API_KEY;
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!apiKey || !companyId) {
    console.error('WHOP_API_KEY and WHOP_COMPANY_ID must be set');
    process.exit(1);
  }

  const Whop = loadWhop();
  const client = new Whop({ apiKey });
  const regions = ['AFRICA','ASIA','EU','GB','US','DEFAULT'] as const;

  // Create Access Pass for Plans
  const planPass = await client.accessPasses.create({ company_id: companyId, name: 'Base Plans', description: 'Subscription tiers' });

  // Create plans per region and tier
  const tiers = ['starter','professional','enterprise'] as const;
  for (const tier of tiers) {
    for (const region of regions) {
      const price = (regionalPricing as any)[region]?.[tier]?.monthly;
      if (!price) continue;
      await client.plans.create({
        company_id: companyId,
        access_pass_id: planPass.id,
        internal_name: `${tier}-${region}-monthly`,
        initial_price: price,
        plan_type: 'renewal',
        renewal_period: 'monthly',
        visibility: 'visible',
      });
      console.log(`Created plan ${tier}-${region}`);
    }
  }

  // Create modules
  const modules = Object.keys(MODULE_PRICING.DEFAULT || {});
  for (const moduleId of ['tours','fleet','hotels','cafe','inventory','payroll']) {
    const access = await client.accessPasses.create({ company_id: companyId, name: `${moduleId} module`, description: `Module: ${moduleId}` });
    for (const region of regions) {
      const price = (MODULE_PRICING as any)[region]?.[moduleId];
      if (!price) continue;
      await client.plans.create({
        company_id: companyId,
        access_pass_id: access.id,
        internal_name: `${moduleId}-${region}`,
        initial_price: price,
        plan_type: 'renewal',
        renewal_period: 'monthly',
        visibility: 'visible',
      });
      console.log(`Created module plan ${moduleId}-${region}`);
    }
  }

  console.log('Whop product setup complete');
}

main().catch((err)=>{ console.error(err); process.exit(1); });
