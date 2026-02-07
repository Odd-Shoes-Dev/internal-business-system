import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { session },
  } = await supabase.auth.getSession();

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

  if (isProtectedPath && !session) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect logged-in users away from auth pages
  const authPaths = ['/login', '/signup', '/forgot-password'];
  const isAuthPath = authPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  );

  // If signups are disabled, block access to the signup page
  const signupsEnabled = process.env.NEXT_PUBLIC_SIGNUPS_ENABLED === 'true';
  if (!signupsEnabled && req.nextUrl.pathname.startsWith('/signup')) {
    // Redirect to login with a hint
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('signup', 'disabled');
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthPath && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Check subscription status for protected routes
  if (isProtectedPath && session) {
    // Skip billing and settings pages from subscription check
    const skipSubscriptionCheck = ['/dashboard/billing', '/dashboard/settings'].some(
      (path) => req.nextUrl.pathname.startsWith(path)
    );

    if (!skipSubscriptionCheck) {
      // Get user's company subscription status
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', session.user.id)
        .single();

      if (profile?.company_id) {
        const { data: settings } = await supabase
          .from('company_settings')
          .select('subscription_status, trial_end_date')
          .eq('company_id', profile.company_id)
          .single();

        // Redirect to billing if subscription is expired
        if (settings?.subscription_status === 'expired') {
          return NextResponse.redirect(new URL('/dashboard/billing?status=expired', req.url));
        }

        // Check if trial has ended
        if (settings?.subscription_status === 'trial' && settings.trial_end_date) {
          const trialEnd = new Date(settings.trial_end_date);
          const now = new Date();
          if (now > trialEnd) {
            return NextResponse.redirect(new URL('/dashboard/billing?status=trial_expired', req.url));
          }
        }
      }
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
