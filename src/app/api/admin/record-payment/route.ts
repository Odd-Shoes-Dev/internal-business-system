import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { isLegacyPlan } from '@/lib/billing/legacy-plan';

const PLAN_TIERS = ['starter', 'professional', 'enterprise'];
const BILLING_PERIODS = ['monthly', 'annual'];

// POST /api/admin/record-payment — a platform admin recording a payment taken outside the
// app (mobile money, bank transfer, cash...). Activates a fresh subscription, or renews an
// existing one, possibly on a different plan (this is also how an upgrade/downgrade with a
// payment attached gets applied). Everything in one transaction, so a failure partway
// through never leaves the company half-updated - the exact thing hand-run SQL scripts
// cannot guarantee.
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const adminError = requirePlatformAdmin(user);
    if (adminError) return adminError;

    const body = await request.json();
    const { company_id, plan_tier, billing_period, amount, currency, purchase_date, note } = body;

    if (!company_id) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    if (!PLAN_TIERS.includes(plan_tier)) {
      return NextResponse.json({ error: `plan_tier must be one of: ${PLAN_TIERS.join(', ')}` }, { status: 400 });
    }
    if (!BILLING_PERIODS.includes(billing_period)) {
      return NextResponse.json({ error: `billing_period must be one of: ${BILLING_PERIODS.join(', ')}` }, { status: 400 });
    }
    const paidAmount = Number(amount);
    if (!(paidAmount >= 0)) return NextResponse.json({ error: 'Enter the amount paid' }, { status: 400 });
    const paidCurrency = String(currency || 'USD').toUpperCase().slice(0, 3);
    const paidAt = purchase_date ? new Date(purchase_date) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      return NextResponse.json({ error: 'purchase_date is not a valid date' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const companyResult = await tx.query<{ id: string; subscription_plan: string | null }>(
        'SELECT id, subscription_plan FROM companies WHERE id = $1 FOR UPDATE',
        [company_id]
      );
      const company = companyResult.rows[0];
      if (!company) return { error: 'Company not found', status: 404 as const };
      if (isLegacyPlan(company.subscription_plan)) {
        return { error: 'This company is on the legacy plan. Manage it from the Legacy Plans section instead.', status: 400 as const };
      }

      // Renewing before the current period actually runs out shouldn't waste the days
      // already paid for - start the new period from the existing end date instead of today.
      const existing = (await tx.query<{ id: string; current_period_end: string }>(
        `SELECT id, current_period_end FROM subscriptions
         WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [company_id]
      )).rows[0];
      const existingEnd = existing ? new Date(existing.current_period_end) : null;
      const periodStart = existingEnd && existingEnd.getTime() > Date.now() ? existingEnd : paidAt;
      const periodEnd = new Date(periodStart);
      if (billing_period === 'annual') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);

      await tx.query(
        `INSERT INTO subscriptions (
           company_id, plan_tier, billing_period, status,
           current_period_start, current_period_end, base_price_amount, currency, updated_at
         ) VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, NOW())`,
        [company_id, plan_tier, billing_period, periodStart.toISOString(), periodEnd.toISOString(), paidAmount, paidCurrency]
      );

      // A paid plan starting (or renewing) ends any trial modules; already-active paid
      // modules are left alone - module changes go through /api/admin/modules.
      await tx.query(
        `UPDATE subscription_modules
         SET is_active = false, removed_at = NOW(), updated_at = NOW()
         WHERE company_id = $1 AND is_trial_module = true AND is_active = true`,
        [company_id]
      );

      await tx.query(
        `UPDATE companies
         SET subscription_status = 'active',
             subscription_plan = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [company_id, `${plan_tier}-${billing_period}`]
      );

      await tx.query(
        `UPDATE company_settings
         SET subscription_status = 'active',
             plan_tier = $2,
             billing_period = $3,
             current_period_start = $4,
             current_period_end = $5,
             updated_at = NOW()
         WHERE company_id = $1`,
        [company_id, plan_tier, billing_period, periodStart.toISOString(), periodEnd.toISOString()]
      );

      const invoiceNumber = `MANUAL-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
      await tx.query(
        `INSERT INTO billing_history (
           company_id, invoice_number, amount, currency, status,
           period_start, period_end, base_plan_cost, paid_at, created_at
         ) VALUES ($1, $2, $3, $4, 'succeeded', $5, $6, $3, $7, NOW())`,
        [company_id, invoiceNumber, paidAmount, paidCurrency, periodStart.toISOString(), periodEnd.toISOString(), paidAt.toISOString()]
      );

      return {
        plan_tier, billing_period, amount: paidAmount, currency: paidCurrency,
        period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(),
        invoice_number: invoiceNumber, note: note ? String(note).slice(0, 500) : null,
      };
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
