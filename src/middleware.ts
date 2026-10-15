import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'blueox_session';

// Hostname this app is normally reached at - everything else (a client's own domain, added as
// a domain alias in Vercel) is a "tenant host". This only decides routing here; which company
// a tenant host belongs to, for branding, is looked up separately by the login page itself via
// /api/companies/branding, not here - a plain hostname comparison needs no database call.
function mainAppHostname(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://system.blueoxgroup.eu').hostname;
  } catch {
    return 'system.blueoxgroup.eu';
  }
}

function isTenantHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(':')[0].toLowerCase();
  return (
    hostname !== mainAppHostname() &&
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1' &&
    !hostname.endsWith('.vercel.app')
  );
}

export async function middleware(req: NextRequest) {
  // A client's own domain is for their team, not for advertising to prospects or letting
  // strangers sign up there - send both to the login screen instead.
  if (isTenantHost(req.headers.get('host'))) {
    const { pathname } = req.nextUrl;
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/login', req.url));
    }
    if (pathname.startsWith('/signup')) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Route handlers cannot see the HTTP method or path from their request headers, so pass
  // them along (used by the read-only-after-trial guard). Always overwritten here, so a
  // client cannot spoof them.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-method', req.method);
  requestHeaders.set('x-request-path', req.nextUrl.pathname);

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Handle CORS for API routes
  if (req.nextUrl.pathname.startsWith('/api/integrations/')) {
    // Add CORS headers for external API access
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Salon-ID, X-API-Key');
    res.headers.set('Access-Control-Max-Age', '86400');

    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: res.headers });
    }

    // Skip auth for API integration routes as they use API key auth
    return res;
  }

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = [
    '/dashboard',
    '/invoices',
    '/bills',
    '/expenses',
    '/inventory',
    '/assets',
    '/reports',
    '/settings',
    '/customers',
    '/vendors',
    '/journal',
    '/accounts',
  ];

  const isProtectedPath = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !hasSession) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect logged-in users away from auth pages (except onboarding pages)
  const authPaths = ['/login', '/signup', '/forgot-password'];
  const onboardingPaths = ['/signup/select-plan', '/checkout/success'];
  const isAuthPath = authPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  );
  const isOnboardingPath = onboardingPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  );

  // If signups are disabled, block access to the signup page (except onboarding)
  const signupsEnabled = process.env.NEXT_PUBLIC_SIGNUPS_ENABLED === 'true';
  if (!signupsEnabled && req.nextUrl.pathname.startsWith('/signup') && !isOnboardingPath) {
    // Redirect to login with a hint
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('signup', 'disabled');
    return NextResponse.redirect(redirectUrl);
  }

  // Allow logged-in users to access onboarding pages, but redirect them away from other auth pages
  if (isAuthPath && hasSession && !isOnboardingPath) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
