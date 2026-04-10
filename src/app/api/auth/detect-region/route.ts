import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';
import { detectRegionFromRequest } from '@/lib/detect-ip-region';
import type { Region } from '@/lib/regional-pricing';

const VALID_REGIONS: Region[] = ['AFRICA', 'ASIA', 'EU', 'GB', 'US', 'DEFAULT'];

/**
 * GET /api/auth/detect-region
 *
 * Returns the user's region, whether it is locked, and the detection source.
 *
 * Response:
 *  { region: Region, locked: boolean, source: 'company' | 'ip' | 'default' }
 *
 * - locked = true  → company already has a committed region (trial or active subscription)
 *                    — the frontend must not allow the user to change it
 * - locked = false → new signup, region auto-detected from IP but user may be warned
 */
export async function GET(request: NextRequest) {
  try {
    // Check if logged-in user's company already has a locked region
    const db = getDbProvider();
    const user = await db.getSessionUser();

    if (user) {
      const result = await db.query(
        `SELECT c.region, c.subscription_status
         FROM companies c
         JOIN user_companies uc ON uc.company_id = c.id
         WHERE uc.user_id = $1
         ORDER BY uc.is_primary DESC
         LIMIT 1`,
        [user.id]
      );

      const company = result.rows[0];
      const companyRegion = company?.region as Region | null;
      const hasActiveSubscription =
        company?.subscription_status === 'active' || company?.subscription_status === 'trial';

      if (companyRegion && VALID_REGIONS.includes(companyRegion) && companyRegion !== 'DEFAULT' && hasActiveSubscription) {
        // Region is locked — return it immediately without IP lookup
        return NextResponse.json({ region: companyRegion, locked: true, source: 'company' });
      }
    }

    // No locked region — detect from IP
    const ipRegion = await detectRegionFromRequest(request);
    const source = ipRegion === 'DEFAULT' ? 'default' : 'ip';

    return NextResponse.json({ region: ipRegion, locked: false, source });
  } catch (error: any) {
    console.error('detect-region error:', error);
    // Never fail a sign-up flow because of region detection
    return NextResponse.json({ region: 'DEFAULT', locked: false, source: 'default' });
  }
}
