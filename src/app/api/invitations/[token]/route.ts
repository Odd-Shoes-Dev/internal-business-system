import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const db = getDbProvider();
    const { token } = await params;

    const result = await db.query(
      `SELECT i.id, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at,
              c.name as company_name,
              u.full_name as invited_by_name
       FROM user_invitations i
       JOIN companies c ON c.id = i.company_id
       LEFT JOIN app_users u ON u.id = i.invited_by
       WHERE i.token = $1`,
      [token]
    );

    if (!result.rowCount) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const invitation = result.rows[0];

    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'This invitation has already been accepted' }, { status: 410 });
    }
    if (invitation.revoked_at) {
      return NextResponse.json({ error: 'This invitation has been revoked' }, { status: 410 });
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    // Check if a user account already exists for this email
    const existingUser = await db.query(
      'SELECT id FROM app_users WHERE lower(email) = lower($1)',
      [invitation.email]
    );

    return NextResponse.json({
      data: {
        ...invitation,
        user_exists: (existingUser.rowCount ?? 0) > 0,
      },
    });
  } catch (error: any) {
    console.error('GET /api/invitations/[token] error:', error);
    return NextResponse.json({ error: 'Failed to load invitation' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { token } = await params;

    const result = await db.query(
      `UPDATE user_invitations
       SET revoked_at = NOW()
       WHERE token = $1 AND accepted_at IS NULL AND revoked_at IS NULL
       RETURNING id`,
      [token]
    );

    if (!result.rowCount) {
      return NextResponse.json(
        { error: 'Invitation not found or already accepted' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/invitations/[token] error:', error);
    return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 });
  }
}
