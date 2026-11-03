import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { getDbProvider } from '@/lib/provider';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/support';

interface TenantCompany {
  name: string;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
}

// Shown at the root of a client's own domain, before the login form, instead of going straight
// to a bare password field with nothing else on the page. Resolved server-side by hostname, the
// same way the login page resolves its branding (see src/app/login/page.tsx).
async function getCompanyForHost(): Promise<TenantCompany | null> {
  try {
    const hostname = (await headers()).get('host')?.split(':')[0].toLowerCase();
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return null;

    const db = getDbProvider();
    const result = await db.query<TenantCompany>(
      `SELECT name, logo_url, address, city, country, phone
       FROM companies WHERE lower(custom_domain) = $1 LIMIT 1`,
      [hostname]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Failed to resolve welcome page company:', error);
    return null;
  }
}

export default async function WelcomePage() {
  const company = await getCompanyForHost();

  // No company mapped to this domain: nothing meaningful to show, go straight to login.
  if (!company) {
    const { redirect } = await import('next/navigation');
    redirect('/login');
  }

  const locationParts = [company!.address, company!.city, company!.country].filter(Boolean);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-md text-center space-y-8">
        <Image
          src={company!.logo_url || '/assets/logo.png'}
          alt={company!.name}
          width={140}
          height={56}
          className="mx-auto object-contain"
        />

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-blueox-primary">{company!.name}</h1>
          <p className="text-lg text-gray-600">
            This is {company!.name}&apos;s business management system: accounting, inventory,
            sales and more, in one place.
          </p>
        </div>

        {(locationParts.length > 0 || company!.phone) && (
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 space-y-1 text-sm text-gray-600">
            {locationParts.length > 0 && <p>{locationParts.join(', ')}</p>}
            {company!.phone && <p>{company!.phone}</p>}
          </div>
        )}

        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black text-lg font-semibold rounded-2xl px-10 py-4 shadow-xl hover:shadow-2xl transition-all duration-300"
        >
          Sign In
        </Link>

        <div className="text-center space-y-2 pt-4">
          <p className="text-sm font-medium text-blueox-primary">Powered by BlueOx</p>
          <p className="text-xs text-gray-500">
            Need help? <a href={supportMailto()} className="hover:text-blueox-primary underline underline-offset-2">{SUPPORT_EMAIL}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
