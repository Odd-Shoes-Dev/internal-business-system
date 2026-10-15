import { headers } from 'next/headers';
import { getDbProvider } from '@/lib/provider';
import LoginForm, { type TenantBranding } from './login-form';

// Resolved on the server, before the page is sent to the browser, so a client's own domain
// shows their branding on the very first paint - no default-then-swap flash from fetching it
// client-side after the page has already rendered with the defaults.
async function getBrandingForHost(): Promise<TenantBranding | null> {
  try {
    const hostname = (await headers()).get('host')?.split(':')[0].toLowerCase();
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return null;

    const db = getDbProvider();
    const result = await db.query<{ name: string; logo_url: string | null }>(
      `SELECT name, logo_url FROM companies WHERE lower(custom_domain) = $1 LIMIT 1`,
      [hostname]
    );
    const company = result.rows[0];
    return company ? { name: company.name, logo_url: company.logo_url } : null;
  } catch (error) {
    console.error('Failed to resolve login branding:', error);
    return null;
  }
}

export default async function LoginPage() {
  const branding = await getBrandingForHost();
  return <LoginForm branding={branding} />;
}
