import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';

export async function requireSessionUser() {
  const db = getDbProvider();
  const user = await db.getSessionUser();

  if (!user) {
    return {
      db,
      user: null,
      errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { db, user, errorResponse: null as NextResponse | null };
}

export function getCompanyIdFromRequest(request: NextRequest, body?: Record<string, any>) {
  if (body && typeof body.company_id === 'string' && body.company_id) {
    return body.company_id;
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');
  return companyId || null;
}

// Resolves which company a request is about, the same way the rest of the app does:
// through the user's company memberships (user_companies), not user_profiles.company_id,
// which is empty for users who were invited into an existing company.
// - requestedCompanyId given: used only if the user has access to it, otherwise null.
// - otherwise: the user's primary membership, then the legacy profile company.
export async function resolveUserCompanyId(
  userId: string,
  requestedCompanyId?: string | null
): Promise<string | null> {
  const db = getDbProvider();

  if (requestedCompanyId) {
    return (await db.hasCompanyAccess(userId, requestedCompanyId)) ? requestedCompanyId : null;
  }

  const membership = await db.query<{ company_id: string }>(
    `SELECT company_id
     FROM user_companies
     WHERE user_id = $1
     ORDER BY is_primary DESC, joined_at ASC
     LIMIT 1`,
    [userId]
  );
  if (membership.rows[0]?.company_id) {
    return membership.rows[0].company_id;
  }

  const profile = await db.query<{ company_id: string | null }>(
    'SELECT company_id FROM user_profiles WHERE id = $1 LIMIT 1',
    [userId]
  );
  return profile.rows[0]?.company_id ?? null;
}

export async function requireCompanyAccess(userId: string, companyId: string) {
  const db = getDbProvider();
  const hasAccess = await db.hasCompanyAccess(userId, companyId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
  }

  return null;
}
