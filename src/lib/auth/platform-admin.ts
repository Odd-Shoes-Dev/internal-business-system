import { NextResponse } from 'next/server';

// Platform administrators run the service (all companies), as opposed to a company's own
// admins. They are listed by email in PLATFORM_ADMIN_EMAILS (comma-separated). The user
// role 'admin' is NOT enough: every company owner gets it when they sign up.
export function isPlatformAdmin(user: { email?: string | null } | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  const admins = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email);
}

export function requirePlatformAdmin(user: { email?: string | null } | null | undefined) {
  return isPlatformAdmin(user)
    ? null
    : NextResponse.json({ error: 'Only platform administrators can do this' }, { status: 403 });
}
