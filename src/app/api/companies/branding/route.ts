import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';

// GET /api/companies/branding?domain=system.applestorembarara.com
//
// Public, no session required - the login screen calls this before anyone is signed in, to
// find out whether the hostname it's being viewed on belongs to a client with their own
// domain. Returns null for the main app domain or any domain not set up this way, so the
// default BlueOx branding is what shows unless a company is actually found.
export async function GET(request: NextRequest) {
  try {
    const domain = request.nextUrl.searchParams.get('domain')?.trim().toLowerCase();
    if (!domain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 });
    }

    const db = getDbProvider();
    const result = await db.query<{ name: string; logo_url: string | null }>(
      `SELECT name, logo_url FROM companies WHERE lower(custom_domain) = $1 LIMIT 1`,
      [domain]
    );

    const company = result.rows[0];
    return NextResponse.json({ data: company ? { name: company.name, logo_url: company.logo_url } : null });
  } catch (error: any) {
    console.error('GET /api/companies/branding error:', error);
    return NextResponse.json({ data: null });
  }
}
