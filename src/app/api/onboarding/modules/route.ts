import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';

const MAX_MODULES = 3;
const MODULE_PRICES: Record<string, number> = {
  tours: 39,
  fleet: 35,
  hotels: 45,
  inventory: 39,
  cafe: 49,
};

export async function POST(request: NextRequest) {
  try {
    const db = getDbProvider();
    const user = await db.getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedModules: unknown[] = Array.isArray(body.modules) ? body.modules : [];
    const normalized: string[] = [...new Set(requestedModules.map((m: unknown) => String(m)))].slice(0, MAX_MODULES);

    const profileResult = await db.query(
      'SELECT company_id FROM user_profiles WHERE id = $1 LIMIT 1',
      [user.id]
    );

    const companyId = profileResult.rows[0]?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Company not found for current user' }, { status: 404 });
    }

    const supportedModules = normalized.filter((moduleId: string) => MODULE_PRICES[moduleId] !== undefined);
    const ignoredModules = normalized.filter((moduleId: string) => MODULE_PRICES[moduleId] === undefined);

    await db.transaction(async (tx) => {
      await tx.query(
        `UPDATE subscription_modules
         SET is_active = FALSE,
             removed_at = NOW(),
             updated_at = NOW()
         WHERE company_id = $1
           AND is_trial_module = TRUE
           AND is_active = TRUE`,
        [companyId]
      );

      for (const moduleId of supportedModules) {
        await tx.query(
          `INSERT INTO subscription_modules (
             company_id, module_id, monthly_price, setup_fee, currency, is_active, is_trial_module
           )
           SELECT $1, $2, $3, 0, 'USD', TRUE, TRUE
           WHERE NOT EXISTS (
             SELECT 1
             FROM subscription_modules
             WHERE company_id = $1
               AND module_id = $2
               AND is_active = TRUE
           )`,
          [companyId, moduleId, MODULE_PRICES[moduleId]]
        );
      }

      const updateSettings = await tx.query(
        `UPDATE company_settings
         SET trial_modules = $2::text[],
             updated_at = NOW()
         WHERE company_id = $1`,
        [companyId, normalized]
      );

      if (updateSettings.rowCount === 0) {
        await tx.query(
          `INSERT INTO company_settings (company_id, trial_modules, created_at, updated_at)
           VALUES ($1, $2::text[], NOW(), NOW())`,
          [companyId, normalized]
        );
      }
    });

    return NextResponse.json({
      success: true,
      selectedModules: normalized,
      ignoredModules,
    });
  } catch (error: any) {
    console.error('onboarding modules error', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save onboarding modules' },
      { status: 500 }
    );
  }
}
