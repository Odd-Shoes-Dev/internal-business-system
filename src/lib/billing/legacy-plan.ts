// The legacy plan: for clients moved over from inventoryMgt. One fixed monthly fee, invoiced
// by us outside Whop/Stripe, with the modules we switch on for them. A legacy company is
// never locked by the trial or subscription checks; ending the plan is a platform admin action.
// Stored as companies.subscription_plan = 'legacy' plus companies.settings -> 'legacy'.

export const LEGACY_PLAN = 'legacy';

export interface LegacyPlanDetails {
  monthly_fee: number;
  currency: string;
  note: string | null;
  started_at: string;
  assigned_by: string | null;
}

export const LEGACY_MESSAGE =
  'Your company is on a legacy plan billed directly by us. Contact support to change modules or billing.';

export function isLegacyPlan(subscriptionPlan: string | null | undefined): boolean {
  return subscriptionPlan === LEGACY_PLAN;
}
