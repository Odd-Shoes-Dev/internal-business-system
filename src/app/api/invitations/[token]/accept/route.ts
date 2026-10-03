import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSessionToken, persistSession } from '@/lib/auth/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const db = getDbProvider();
    const { token } = await params;
    const body = await request.json();
    const { fullName, password } = body;

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const invResult = await db.query(
      `SELECT * FROM user_invitations WHERE token = $1`,
      [token]
    );

    if (!invResult.rowCount) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const invitation = invResult.rows[0];

    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 410 });
    }
    if (invitation.revoked_at) {
      return NextResponse.json({ error: 'Invitation has been revoked' }, { status: 410 });
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    const existingUserResult = await db.query(
      'SELECT id, password_hash, full_name FROM app_users WHERE lower(email) = lower($1)',
      [invitation.email]
    );

    let userId: string;
    let profileFullName: string | null = null;

    if ((existingUserResult.rowCount ?? 0) > 0) {
      const existingUser = existingUserResult.rows[0];
      if (!verifyPassword(password, existingUser.password_hash)) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
      }
      userId = existingUser.id;
      profileFullName = existingUser.full_name ?? null;
    } else {
      if (!fullName || !fullName.trim()) {
        return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
      }
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        );
      }

      const passwordHash = hashPassword(password);
      const newUserResult = await db.query(
        `INSERT INTO app_users (email, full_name, password_hash, role, email_verified)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id`,
        [invitation.email.toLowerCase(), fullName.trim(), passwordHash, invitation.role]
      );
      userId = newUserResult.rows[0].id;
      profileFullName = fullName.trim();
    }

    const alreadyMember = await db.query(
      'SELECT user_id FROM user_companies WHERE user_id = $1 AND company_id = $2',
      [userId, invitation.company_id]
    );

    if (!alreadyMember.rowCount) {
      try {
        await db.query(
          `INSERT INTO user_companies (user_id, company_id, role, is_primary, joined_at)
           VALUES ($1, $2, $3, TRUE, NOW())`,
          [userId, invitation.company_id, invitation.role]
        );
      } catch (ucErr: any) {
        console.error('[accept] user_companies INSERT failed:', ucErr?.message, ucErr?.code, ucErr?.detail);
        throw ucErr;
      }
    }

    // Several routes still find the user's company through user_profiles.company_id, and
    // invited users have no profile row, so they would get "Company not found". Create one
    // and fill in the company only if it is empty - never move an existing home company.
    // No role is set here: profile roles are granted deliberately, not copied from invites
    // (an invite role like "manager" is not even a valid profile role).
    try {
      await db.query(
        `INSERT INTO user_profiles (id, email, full_name, is_active, company_id)
         VALUES ($1, $2, $3, TRUE, $4)
         ON CONFLICT (id) DO UPDATE
         SET company_id = COALESCE(user_profiles.company_id, EXCLUDED.company_id),
             updated_at = NOW()`,
        [userId, invitation.email.toLowerCase(), profileFullName, invitation.company_id]
      );
    } catch (profileErr: any) {
      // Non-fatal: membership (user_companies) is the source of truth and already saved.
      console.error('[accept] user_profiles upsert failed:', profileErr?.message);
    }

    try {
      await db.query(
        'UPDATE user_invitations SET accepted_at = NOW() WHERE token = $1',
        [token]
      );
    } catch (updErr: any) {
      console.error('[accept] user_invitations UPDATE failed:', updErr?.message);
      throw updErr;
    }

    const sessionToken = createSessionToken();
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : undefined;
    try {
      await persistSession(
        userId,
        sessionToken,
        ipAddress,
        request.headers.get('user-agent') ?? undefined
      );
    } catch (sessErr: any) {
      console.error('[accept] persistSession failed:', sessErr?.message);
      throw sessErr;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POST /api/invitations/[token]/accept error:', error?.message, error?.code, error?.detail);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
