import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth/password';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const newPassword = String(body.new_password || '');

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const passwordHash = hashPassword(newPassword);

    await db.query(
      `UPDATE app_users
       SET password_hash = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id, passwordHash]
    );

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Failed to change password:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
