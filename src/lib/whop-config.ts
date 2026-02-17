import { Region } from './regional-pricing';

// Placeholder mapping. Run `scripts/setup-whop-products.ts` to populate real plan IDs.
export const WHOP_PLAN_IDS: Record<string, Record<Region, string>> = {
  'starter-monthly': {
    AFRICA: '', ASIA: '', EU: '', GB: '', US: '', DEFAULT: ''
  },
  'starter-annual': { AFRICA: '', ASIA: '', EU: '', GB: '', US: '', DEFAULT: '' },
  'professional-monthly': { AFRICA: '', ASIA: '', EU: '', GB: '', US: '', DEFAULT: '' },
  'professional-annual': { AFRICA: '', ASIA: '', EU: '', GB: '', US: '', DEFAULT: '' },
  'enterprise-monthly': { AFRICA: '', ASIA: '', EU: '', GB: '', US: '', DEFAULT: '' },
  'enterprise-annual': { AFRICA: '', ASIA: '', EU: '', GB: '', US: '', DEFAULT: '' },
};

export const WHOP_MODULE_IDS: Record<string, Record<Region, string>> = {
  tours: { AFRICA: '', ASIA: '', EU: '', GB: '', US: '', DEFAULT: '' },
  fleet: { AFRICA: '', ASIA: '', EU: '', GB: '', US: '', DEFAULT: '' },
  hotels: { AFRICA: '', ASIA: '', EU: '', GB: '', US: '', DEFAULT: '' },
  cafe: { AFRICA: '', ASIA: '', EU: '', GB: '', US: '', DEFAULT: '' },
  inventory: { AFRICA: '', ASIA: '', EU: '', GB: '', US: '', DEFAULT: '' },
  payroll: { AFRICA: '', ASIA: '', EU: '', GB: '', US: '', DEFAULT: '' },
};

export function getPlanId(planTier: string, billingPeriod: string, region: Region): string {
  const key = `${planTier}-${billingPeriod}`;
  const id = (WHOP_PLAN_IDS as any)[key]?.[region];
  if (!id) throw new Error(`No Whop plan id for ${key} in ${region}`);
  return id;
}

export function getModulePlanId(moduleId: string, region: Region): string {
  const id = (WHOP_MODULE_IDS as any)[moduleId]?.[region];
  if (!id) throw new Error(`No Whop module plan id for ${moduleId} in ${region}`);
  return id;
}
