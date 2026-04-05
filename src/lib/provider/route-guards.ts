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

export async function requireCompanyAccess(userId: string, companyId: string) {
  const db = getDbProvider();
  const hasAccess = await db.hasCompanyAccess(userId, companyId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
  }

  return null;
}
