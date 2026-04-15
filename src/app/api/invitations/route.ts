import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import {
  requireSessionUser,
  getCompanyIdFromRequest,
  requireCompanyAccess,
} from '@/lib/provider/route-guards';
import { sendInvitationEmail } from '@/lib/email/resend';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const [membersResult, invitationsResult] = await Promise.all([
      db.query(
        `SELECT u.id, u.email, u.full_name, u.last_login_at, u.created_at,
                uc.joined_at, uc.role as company_role, uc.is_primary
         FROM user_companies uc
         JOIN app_users u ON u.id = uc.user_id
         WHERE uc.company_id = $1
         ORDER BY uc.is_primary DESC, uc.joined_at ASC`,
        [companyId]
      ),
      db.query(
        `SELECT i.id, i.email, i.role, i.token, i.created_at, i.expires_at,
                u.full_name as invited_by_name
         FROM user_invitations i
         LEFT JOIN app_users u ON u.id = i.invited_by
         WHERE i.company_id = $1
           AND i.accepted_at IS NULL
           AND i.revoked_at IS NULL
           AND i.expires_at > NOW()
         ORDER BY i.created_at DESC`,
        [companyId]
      ),
    ]);

    return NextResponse.json({
      members: membersResult.rows,
      invitations: invitationsResult.rows,
    });
  } catch (error: any) {
    console.error('GET /api/invitations error:', error);
    return NextResponse.json({ error: 'Failed to load team data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const { company_id, email, role } = body;

    if (!company_id || !email || !role) {
      return NextResponse.json(
        { error: 'company_id, email and role are required' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'accountant', 'operations', 'sales', 'guide', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, company_id);
    if (accessError) return accessError;

    const alreadyMember = await db.query(
      `SELECT uc.user_id FROM user_companies uc
       JOIN app_users u ON u.id = uc.user_id
       WHERE uc.company_id = $1 AND lower(u.email) = lower($2)`,
      [company_id, email]
    );
    if (alreadyMember.rowCount) {
      return NextResponse.json(
        { error: 'This user is already a member of your company' },
        { status: 409 }
      );
    }

    const existingInvite = await db.query(
      `SELECT id FROM user_invitations
       WHERE company_id = $1 AND lower(email) = lower($2)
         AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()`,
      [company_id, email]
    );
    if (existingInvite.rowCount) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email' },
        { status: 409 }
      );
    }

    const companyResult = await db.query(
      'SELECT name FROM companies WHERE id = $1',
      [company_id]
    );
    const companyName = companyResult.rows[0]?.name || 'the company';

    const inviterResult = await db.query(
      'SELECT full_name, email FROM app_users WHERE id = $1',
      [user.id]
    );
    const inviter = inviterResult.rows[0];

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const result = await db.query(
      `INSERT INTO user_invitations (company_id, email, role, token, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [company_id, email.toLowerCase().trim(), role, token, user.id, expiresAt]
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blueox.app';

    await sendInvitationEmail({
      to: email,
      invitedByName: inviter?.full_name || inviter?.email || 'Your team admin',
      companyName,
      role,
      inviteLink: `${appUrl}/invite/${token}`,
      expiresAt: expiresAt.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    });

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/invitations error:', error);
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
  }
}
