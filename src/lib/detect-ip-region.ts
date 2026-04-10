import type { NextRequest } from 'next/server';
import { mapCountryToRegion } from '@/lib/regional-pricing';
import type { Region } from '@/lib/regional-pricing';

/**
 * Detects the user's region from the incoming request headers.
 * Priority:
 *  1. CF-IPCountry  (Cloudflare)
 *  2. x-vercel-ip-country (Vercel edge)
 *  3. ipapi.co lookup using x-forwarded-for / x-real-ip
 *  4. DEFAULT fallback
 */
export async function detectRegionFromRequest(request: NextRequest): Promise<Region> {
  // 1. Cloudflare header
  const cfCountry = request.headers.get('CF-IPCountry') || request.headers.get('cf-ipcountry');
  if (cfCountry && cfCountry !== 'XX' && cfCountry.length === 2) {
    return mapCountryToRegion(cfCountry);
  }

  // 2. Vercel edge header
  const vercelCountry = request.headers.get('x-vercel-ip-country');
  if (vercelCountry && vercelCountry.length === 2) {
    return mapCountryToRegion(vercelCountry);
  }

  // 3. ipapi.co IP lookup (fast free tier, ~1000 req/day — more than enough for a sign-up flow)
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip');

    const isLocalhost =
      !ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.');

    if (!isLocalhost) {
      const res = await fetch(`https://ipapi.co/${ip}/country/`, {
        signal: AbortSignal.timeout(2500),
        headers: { 'User-Agent': 'blueox-business-platform/1.0' },
      });
      if (res.ok) {
        const countryCode = (await res.text()).trim().toUpperCase();
        if (countryCode.length === 2) {
          return mapCountryToRegion(countryCode);
        }
      }
    }
  } catch {
    // timeout or network error — fall through to DEFAULT
  }

  return 'DEFAULT';
}
