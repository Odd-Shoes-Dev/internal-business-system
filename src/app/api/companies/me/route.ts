import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const memberships = await db.query<{
      company_id: string;
      is_primary: boolean;
      role: string;
      name: string;
      subdomain: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      logo_url: string | null;
      currency: string | null;
      subscription_status: string | null;
      subscription_plan: string | null;
      tax_id: string | null;
      registration_number: string | null;
      trial_ends_at: string | null;
      region: 'AFRICA' | 'ASIA' | 'EU' | 'GB' | 'US' | 'DEFAULT' | null;
    }>(
      `SELECT uc.company_id,
              uc.is_primary,
              uc.role,
              c.name,
              c.subdomain,
              c.email,
              c.phone,
              c.address,
              c.logo_url,
              c.currency,
              c.subscription_status,
              c.subscription_plan,
              c.tax_id,
              c.registration_number,
              c.trial_ends_at,
              c.region
       FROM user_companies uc
       INNER JOIN companies c ON c.id = uc.company_id
       WHERE uc.user_id = $1
       ORDER BY uc.is_primary DESC, uc.joined_at ASC`,
      [user.id]
    );

    const companies = memberships.rows.map((row) => ({
      id: row.company_id,
      name: row.name,
      subdomain: row.subdomain,
      email: row.email,
      phone: row.phone,
      address: row.address,
      logo_url: row.logo_url,
      currency: row.currency || 'USD',
      subscription_status: row.subscription_status || 'trial',
      subscription_plan: row.subscription_plan || 'professional',
      tax_id: row.tax_id,
      registration_number: row.registration_number,
      trial_ends_at: row.trial_ends_at,
      region: row.region || 'DEFAULT',
      role: row.role,
      is_primary: row.is_primary,
    }));

    let selectedCompanyId = getCompanyIdFromRequest(request);
    if (!selectedCompanyId) {
      selectedCompanyId = companies.find((c) => c.is_primary)?.id || companies[0]?.id || null;
    }

    let modules: string[] = [];
    if (selectedCompanyId) {
      const moduleRows = await db.query<{ module_id: string }>(
        'SELECT module_id FROM subscription_modules WHERE company_id = $1 AND is_active = TRUE',
        [selectedCompanyId]
      );
      modules = moduleRows.rows.map((m) => m.module_id);
    }

    return NextResponse.json({
      user,
      companies,
      currentCompanyId: selectedCompanyId,
      modules,
    });
  } catch (error: any) {
    console.error('Failed to load user companies:', error);
    return NextResponse.json({ error: 'Failed to load user companies' }, { status: 500 });
  }
}
