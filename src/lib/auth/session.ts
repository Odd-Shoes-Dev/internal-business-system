import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { getNeonPool } from '@/lib/db/neon';

const SESSION_COOKIE = 'blueox_session';
const SESSION_DAYS = 14;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createSessionToken(): string {
  return randomBytes(48).toString('base64url');
}

export async function persistSession(userId: string, token: string, ipAddress?: string, userAgent?: string) {
  const pool = getNeonPool();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO app_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, sha256(token), expiresAt, ipAddress ?? null, userAgent ?? null]
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const pool = getNeonPool();
    await pool.query('UPDATE app_sessions SET revoked_at = NOW() WHERE token_hash = $1', [sha256(token)]);
  }

  cookieStore.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const pool = getNeonPool();
  const result = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.is_active
     FROM app_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
       AND u.is_active = TRUE
     LIMIT 1`,
    [sha256(token)]
  );

  return result.rows[0] ?? null;
}
