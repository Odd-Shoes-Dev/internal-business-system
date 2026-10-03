import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser, resolveUserCompanyId } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    // Get the company this request is about (the selected one, else the user's primary)
    const companyId = await resolveUserCompanyId(
      user.id,
      new URL(request.url).searchParams.get('company_id')
    );

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
