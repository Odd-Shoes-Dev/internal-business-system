import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/fiscal-periods/reopen - Reopen a fiscal period
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    // Check if user is admin
    const profileResult = await db.query('SELECT role FROM user_profiles WHERE id = $1 LIMIT 1', [user.id]);
    const profile = profileResult.rows[0];

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can reopen fiscal periods' },
        { status: 403 }
      );
    }

    if (!body.period_id) {
      return NextResponse.json(
        { error: 'Missing required field: period_id' },
        { status: 400 }
      );
    }

    const periodResult = await db.query(
      'SELECT id, company_id FROM fiscal_periods WHERE id = $1 LIMIT 1',
      [body.period_id]
    );
    const period = periodResult.rows[0];

    if (!period) {
      return NextResponse.json({ error: 'Fiscal period not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, period.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Update period status to open
    const updateResult = await db.query(
      `UPDATE fiscal_periods
       SET status = 'open',
           closed_by = NULL,
           closed_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [body.period_id]
    );

    const data = updateResult.rows[0];

    return NextResponse.json({
      data,
      message: 'Fiscal period reopened successfully'
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
