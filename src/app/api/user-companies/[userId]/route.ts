import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';
import { requireSessionUser } from '@/lib/provider/route-guards';

const VALID_ROLES = ['admin', 'accountant', 'operations', 'sales', 'guide', 'viewer'];

// PATCH /api/user-companies/[userId] — update a member's role within a company
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { userId } = await params;
    const body = await request.json();
    const { company_id, role } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }
    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
    }

    // Verify the requesting user is an admin in this company
    const requesterResult = await db.query(
      'SELECT role FROM user_companies WHERE user_id = $1 AND company_id = $2',
      [user.id, company_id]
    );
    if (!requesterResult.rowCount || requesterResult.rows[0].role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can change member roles' }, { status: 403 });
    }

    // Prevent changing the primary owner's role
    const targetResult = await db.query(
      'SELECT is_primary FROM user_companies WHERE user_id = $1 AND company_id = $2',
      [userId, company_id]
    );
    if (!targetResult.rowCount) {
      return NextResponse.json({ error: 'User is not a member of this company' }, { status: 404 });
    }
    if (targetResult.rows[0].is_primary) {
      return NextResponse.json({ error: "Cannot change the owner's role" }, { status: 403 });
    }

    // Prevent admin from changing their own role (safety guard)
    if (userId === user.id) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 403 });
    }

    await db.query(
      'UPDATE user_companies SET role = $1 WHERE user_id = $2 AND company_id = $3',
      [role, userId, company_id]
    );

    return NextResponse.json({ success: true, role });
  } catch (error: any) {
    console.error('PATCH /api/user-companies/[userId] error:', error?.message);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}
