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

    if ((existingUserResult.rowCount ?? 0) > 0) {
      const existingUser = existingUserResult.rows[0];
      if (!verifyPassword(password, existingUser.password_hash)) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
      }
      userId = existingUser.id;
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
    }

    const alreadyMember = await db.query(
      'SELECT user_id FROM user_companies WHERE user_id = $1 AND company_id = $2',
      [userId, invitation.company_id]
    );

    if (!alreadyMember.rowCount) {
      await db.query(
        `INSERT INTO user_companies (user_id, company_id, role, is_primary, joined_at)
         VALUES ($1, $2, $3, TRUE, NOW())`,
        [userId, invitation.company_id, invitation.role]
      );
    }

    await db.query(
      'UPDATE user_invitations SET accepted_at = NOW() WHERE token = $1',
      [token]
    );

    const sessionToken = createSessionToken();
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : undefined;
    await persistSession(
      userId,
      sessionToken,
      ipAddress,
      request.headers.get('user-agent') ?? undefined
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POST /api/invitations/[token]/accept error:', error);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
