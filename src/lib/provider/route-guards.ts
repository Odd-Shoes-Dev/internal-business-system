import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getDbProvider } from '@/lib/provider';
import {
  ENFORCE_READ_ONLY_AFTER_TRIAL,
  READ_ONLY_EXEMPT_PATH_PREFIXES,
  TRIAL_EXPIRED_MESSAGE,
  WRITE_METHODS,
  isTrialExpired,
} from '@/lib/subscription-access';

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

// Whether the user is an owner/admin of THIS company. The role on their membership in
// the company decides. The session (app_users) role is only a fallback for a membership
// that has no role, so being admin of their own company does not make someone an admin
// of every company they are invited into. Not a member = not an admin.
export async function isCompanyAdmin(
  userId: string,
  sessionRole: string | null | undefined,
  companyId: string
): Promise<boolean> {
  const db = getDbProvider();
  const membership = await db.query<{ role: string | null }>(
    'SELECT role FROM user_companies WHERE user_id = $1 AND company_id = $2 LIMIT 1',
    [userId, companyId]
  );
  const row = membership.rows[0];
  if (!row) return false;
  if (row.role) return ['owner', 'admin'].includes(row.role);
  return sessionRole === 'admin';
}

// Returns a 403 response unless the user is an owner/admin of the company, else null.
export async function requireCompanyAdmin(
  userId: string,
  sessionRole: string | null | undefined,
  companyId: string,
  message = 'Only a company owner or admin can do this'
) {
  if (await isCompanyAdmin(userId, sessionRole, companyId)) {
    return null;
  }
  return NextResponse.json({ error: message }, { status: 403 });
}

// Read-only mode after a trial ends (see lib/subscription-access.ts). Only write requests
// (POST/PUT/PATCH/DELETE) to a company whose trial has expired are refused; reads, printing
// and the exempt paths (billing, auth, reports, ...) are untouched. Does nothing while the
// master switch is off, and fails open if the request method cannot be determined.
async function blockWriteIfTrialExpired(companyId: string) {
  if (!ENFORCE_READ_ONLY_AFTER_TRIAL) return null;

  let method = '';
  let path = '';
  try {
    const requestHeaders = await headers();
    method = (requestHeaders.get('x-request-method') || '').toUpperCase();
    path = requestHeaders.get('x-request-path') || '';
  } catch {
    return null; // not inside a request (e.g. a script)
  }

  if (!WRITE_METHODS.includes(method)) return null;
  if (READ_ONLY_EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;

  const db = getDbProvider();
  const result = await db.query<{ subscription_status: string | null; trial_ends_at: string | null }>(
    'SELECT subscription_status, trial_ends_at FROM companies WHERE id = $1 LIMIT 1',
    [companyId]
  );
  const company = result.rows[0];
  if (company && isTrialExpired(company.subscription_status, company.trial_ends_at)) {
    return NextResponse.json({ error: TRIAL_EXPIRED_MESSAGE, code: 'TRIAL_EXPIRED' }, { status: 402 });
  }

  return null;
}

export async function requireCompanyAccess(userId: string, companyId: string) {
  const db = getDbProvider();
  const hasAccess = await db.hasCompanyAccess(userId, companyId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
  }

  return blockWriteIfTrialExpired(companyId);
}
