import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    // Get user's company
    const profile = await db.query<{ company_id: string }>(
      'SELECT company_id FROM user_profiles WHERE id = $1 LIMIT 1',
      [user.id]
    );
    const companyId = profile.rows[0]?.company_id;

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get billing history
    const history = await db.query(
      `SELECT *
       FROM billing_history
       WHERE company_id = $1
       ORDER BY paid_at DESC
       LIMIT 50`,
      [companyId]
    );

    return NextResponse.json({
      history: history.rows || [],
    });
  } catch (error) {
    console.error('Error fetching billing history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing history' },
      { status: 500 }
    );
  }
}
