import { NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { LEGACY_PLAN } from '@/lib/billing/legacy-plan';

// GET /api/admin/companies — every company for the "Manage Company" picker, except legacy
// plan companies (they have their own section and don't use the subscriptions table at all).
export async function GET() {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const adminError = requirePlatformAdmin(user);
    if (adminError) return adminError;

    const result = await db.query(
      `SELECT id, name, country, region, subscription_plan, subscription_status
       FROM companies
       WHERE subscription_plan IS DISTINCT FROM $1
       ORDER BY name`,
      [LEGACY_PLAN]
    );
    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
