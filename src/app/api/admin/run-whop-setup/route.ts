import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { regionalPricing, MODULE_PRICING } from '@/lib/regional-pricing';

const BASE_URL = 'https://api.whop.com/api/v1';

async function createProduct(apiKey: string, companyId: string, name: string, description?: string) {
  const res = await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_id: companyId, title: name, description }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create product ${name}: ${res.status} ${body}`);
  }
  return res.json();
}

async function createPlan(apiKey: string, companyId: string, productId: string, payload: any) {
  const body = { company_id: companyId, product_id: productId, ...payload };
  const res = await fetch(`${BASE_URL}/plans`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create plan: ${res.status} ${text}`);
  }
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-whop-setup-secret');
    const configured = process.env.WHOP_SETUP_SECRET;
    if (!configured || !secret || secret !== configured) {
      return NextResponse.json({ error: 'Missing or invalid setup secret' }, { status: 401 });
    }

    const apiKey = process.env.WHOP_API_KEY;
    const companyId = process.env.WHOP_COMPANY_ID;
    if (!apiKey || !companyId) {
      return NextResponse.json({ error: 'WHOP_API_KEY and WHOP_COMPANY_ID must be set in Vercel' }, { status: 500 });
    }

    const regions = ['AFRICA','ASIA','EU','GB','US','DEFAULT'] as const;
    const tiers = ['starter','professional','enterprise'] as const;

    const results: any = { plans: {}, modules: {} };

    // Create base product for plans
    const baseProduct = await createProduct(apiKey, companyId, 'Base Plans', 'Subscription tiers');

    for (const tier of tiers) {
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
        results.plans[internalName] = results.plans[internalName] || {};
        results.plans[internalName][region] = plan.id;
      }
    }

    const moduleList = ['tours','fleet','hotels','cafe','inventory','payroll'];
    for (const moduleId of moduleList) {
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
        results.modules[moduleId][region] = plan.id;
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
