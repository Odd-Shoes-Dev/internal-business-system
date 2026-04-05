import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('me error', error);
    return NextResponse.json({ error: 'Failed to get session user' }, { status: 500 });
  }
}
