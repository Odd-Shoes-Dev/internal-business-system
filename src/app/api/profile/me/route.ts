import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function GET() {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const profileResult = await db.query(
      `SELECT full_name
       FROM user_profiles
       WHERE id = $1
       LIMIT 1`,
      [user.id]
    );

    const profile = profileResult.rows[0] || null;

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email || '',
        full_name: profile?.full_name || user.full_name || '',
      },
    });
  } catch (error: any) {
    console.error('Failed to load profile:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const fullName = String(body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!fullName || !email) {
      return NextResponse.json({ error: 'full_name and email are required' }, { status: 400 });
    }

    const duplicateEmail = await db.query(
      `SELECT id
       FROM app_users
       WHERE email = $1
         AND id <> $2
       LIMIT 1`,
      [email, user.id]
    );

    if (duplicateEmail.rowCount) {
      return NextResponse.json({ error: 'Email is already in use' }, { status: 409 });
    }

    await db.transaction(async (tx: any) => {
      await tx.query(
        `UPDATE app_users
         SET email = $2,
             full_name = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [user.id, email, fullName]
      );

      await tx.query(
        `INSERT INTO user_profiles (id, email, full_name, is_active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (id)
         DO UPDATE SET email = EXCLUDED.email,
                       full_name = EXCLUDED.full_name,
                       updated_at = NOW()`,
        [user.id, email, fullName]
      );
    });

    return NextResponse.json({
      data: {
        id: user.id,
        email,
        full_name: fullName,
      },
      message: 'Profile updated successfully',
    });
  } catch (error: any) {
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
