import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { AVAILABLE_MODULES } from '@/lib/modules';
import { LEGACY_PLAN } from '@/lib/billing/legacy-plan';

// Modules a legacy plan can include: everything that is live (not 'coming soon')
const LEGACY_MODULES = Object.values(AVAILABLE_MODULES)
  .filter((m) => m.id !== 'core' && !m.comingSoon)
  .map((m) => m.id);

type Guarded =
  | { error: NextResponse }
  | { db: Awaited<ReturnType<typeof requireSessionUser>>['db']; user: { id: string; email: string } };

async function guard(): Promise<Guarded> {
  const { db, user, errorResponse } = await requireSessionUser();
  if (errorResponse || !user) return { error: errorResponse ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const adminError = requirePlatformAdmin(user);
  if (adminError) return { error: adminError };
  return { db, user };
}

// GET /api/admin/legacy-plan — every company with its plan, status and active modules
export async function GET() {
  try {
    const ctx = await guard();
    if ('error' in ctx) return ctx.error;
    const result = await ctx.db.query(
      `SELECT c.id, c.name, c.subscription_plan, c.subscription_status, c.currency, c.settings -> 'legacy' AS legacy,
              COALESCE(array_agg(sm.module_id ORDER BY sm.module_id) FILTER (WHERE sm.is_active), '{}') AS modules
       FROM companies c
       LEFT JOIN subscription_modules sm ON sm.company_id = c.id
       GROUP BY c.id
       ORDER BY (c.subscription_plan = $1) DESC, c.name`,
      [LEGACY_PLAN]
    );
    return NextResponse.json({ data: result.rows, available_modules: LEGACY_MODULES });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/legacy-plan — put a company on (or update) the legacy plan
// { company_id, monthly_fee, currency, modules: string[], note? }
export async function POST(request: NextRequest) {
  try {
    const ctx = await guard();
    if ('error' in ctx) return ctx.error;
    const body = await request.json();
    const fee = Number(body.monthly_fee);
    if (!body.company_id) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    if (!(fee >= 0)) return NextResponse.json({ error: 'Enter the monthly fee' }, { status: 400 });
    const modules: string[] = (Array.isArray(body.modules) ? body.modules : LEGACY_MODULES).filter((m: string) => LEGACY_MODULES.includes(m));

    const result = await ctx.db.transaction(async (tx) => {
      const company = (await tx.query<any>("SELECT id, settings -> 'legacy' AS legacy FROM companies WHERE id = $1 FOR UPDATE", [body.company_id])).rows[0];
      if (!company) return null;
      const details = {
        monthly_fee: fee,
        currency: String(body.currency || 'UGX').toUpperCase().slice(0, 3),
        note: body.note ? String(body.note).slice(0, 500) : null,
        started_at: company.legacy?.started_at || new Date().toISOString(),
        assigned_by: ctx.user.email,
      };
      await tx.query(
        `UPDATE companies
         SET subscription_plan = $2, subscription_status = 'active', trial_ends_at = NULL,
             settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{legacy}', $3::jsonb, true), updated_at = NOW()
         WHERE id = $1`,
        [body.company_id, LEGACY_PLAN, JSON.stringify(details)]
      );
      await tx.query(
        `UPDATE company_settings SET subscription_status = 'active', updated_at = NOW() WHERE company_id = $1`,
        [body.company_id]
      );

      // Exactly the chosen modules are on, at no per-module charge (the fee covers them)
      await tx.query(
        `UPDATE subscription_modules SET is_active = false, removed_at = NOW(), updated_at = NOW()
         WHERE company_id = $1 AND is_active AND NOT (module_id = ANY($2::text[]))
           AND NOT EXISTS (SELECT 1 FROM subscription_modules x
                           WHERE x.company_id = subscription_modules.company_id AND x.module_id = subscription_modules.module_id AND NOT x.is_active)`,
        [body.company_id, modules]
      );
      await tx.query(
        `DELETE FROM subscription_modules WHERE company_id = $1 AND is_active AND NOT (module_id = ANY($2::text[]))`,
        [body.company_id, modules]
      );
      await tx.query(
        `INSERT INTO subscription_modules (company_id, module_id, monthly_price, setup_fee, currency, is_active, is_included)
         SELECT $1, m, 0, 0, $3, true, true FROM unnest($2::text[]) AS m
         WHERE NOT EXISTS (SELECT 1 FROM subscription_modules sm WHERE sm.company_id = $1 AND sm.module_id = m AND sm.is_active)`,
        [body.company_id, modules, details.currency]
      );
      return { ...details, modules };
    });

    if (!result) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/legacy-plan?company_id= — end the legacy plan. The company becomes
// 'expired' (read-only) until it is moved to a normal paid plan.
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await guard();
    if ('error' in ctx) return ctx.error;
    const companyId = new URL(request.url).searchParams.get('company_id');
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    const result = await ctx.db.query(
      `UPDATE companies
       SET subscription_plan = 'professional', subscription_status = 'expired',
           settings = COALESCE(settings, '{}'::jsonb) - 'legacy', updated_at = NOW()
       WHERE id = $1 AND subscription_plan = $2
       RETURNING id`,
      [companyId, LEGACY_PLAN]
    );
    if (!result.rowCount) return NextResponse.json({ error: 'That company is not on the legacy plan' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
