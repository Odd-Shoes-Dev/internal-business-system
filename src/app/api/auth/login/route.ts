import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';
import { verifyPassword } from '@/lib/auth/password';
import { createSessionToken, persistSession } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
    }

    const db = getDbProvider();
    const result = await db.query(
      'SELECT id, email, full_name, role, password_hash, is_active FROM app_users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (!result.rowCount) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = result.rows[0];
    if (!user.is_active || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await db.query('UPDATE app_users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const companyMembership = await db.query(
      'SELECT company_id FROM user_companies WHERE user_id = $1 LIMIT 1',
      [user.id]
    );

    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : undefined;

    const token = createSessionToken();
    await persistSession(user.id, token, ipAddress, req.headers.get('user-agent') ?? undefined);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
      needsOnboarding: companyMembership.rowCount === 0,
    });
  } catch (error) {
    console.error('login error', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
