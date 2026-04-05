import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';
import { hashPassword } from '@/lib/auth/password';
import { createSessionToken, persistSession } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const fullName = String(body.fullName || '').trim();
    const companyName = String(body.companyName || '').trim();
    const country = String(body.country || 'Uganda').trim();

    if (!email || !password || !fullName || !companyName) {
      return NextResponse.json({ error: 'email, password, fullName and companyName are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const db = getDbProvider();
    const exists = await db.query('SELECT id FROM app_users WHERE email = $1 LIMIT 1', [email]);
    if (exists.rowCount) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const passwordHash = hashPassword(password);

    const created = await db.query(
      `INSERT INTO app_users (email, full_name, password_hash, role, email_verified)
       VALUES ($1, $2, $3, 'admin', TRUE)
       RETURNING id, email, full_name, role`,
      [email, fullName, passwordHash]
    );

    const user = created.rows[0];

    // Insert into compat auth.users so existing DB trigger flow creates
    // companies, user_profiles, user_companies and company_settings.
    await db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
      [
        user.id,
        email,
        JSON.stringify({
          full_name: fullName,
          company_name: companyName,
          country,
        }),
      ]
    );

    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : undefined;

    const token = createSessionToken();
    await persistSession(user.id, token, ipAddress, req.headers.get('user-agent') ?? undefined);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('register error', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
