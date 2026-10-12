import { NextResponse } from 'next/server';
import type { QueryExecutor } from '@/lib/accounting/provider-accounting';
import { LEGACY_MESSAGE, LEGACY_PLAN, type LegacyPlanDetails } from '@/lib/billing/legacy-plan';

export async function getLegacyPlanWithDb(q: QueryExecutor, companyId: string): Promise<LegacyPlanDetails | null> {
  const r = await q.query<{ subscription_plan: string | null; legacy: LegacyPlanDetails | null }>(
    "SELECT subscription_plan, settings -> 'legacy' AS legacy FROM companies WHERE id = $1",
    [companyId]
  );
  const row = r.rows[0];
  if (!row || row.subscription_plan !== LEGACY_PLAN) return null;
  return row.legacy ?? { monthly_fee: 0, currency: 'UGX', note: null, started_at: '', assigned_by: null };
}

// Self-service billing (checkout, plan and module changes) does not apply to legacy companies
export async function refuseIfLegacyWithDb(q: QueryExecutor, companyId: string | null | undefined) {
  if (!companyId) return null;
  return (await getLegacyPlanWithDb(q, companyId)) ? NextResponse.json({ error: LEGACY_MESSAGE }, { status: 400 }) : null;
}
