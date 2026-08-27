import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/notifications/reads?company_id=... - IDs of notifications this user has already read
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const result = await db.query(
      `SELECT notification_id FROM notification_reads WHERE user_id = $1 AND company_id = $2`,
      [user.id, companyId]
    );

    return NextResponse.json({ data: result.rows.map((r: any) => r.notification_id) });
  } catch (error: any) {
    console.error('Error fetching notification reads:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/notifications/reads - Mark one or more notifications as read for this user
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const companyId = getCompanyIdFromRequest(request, body);
    const notificationIds: string[] = Array.isArray(body.notification_ids)
      ? body.notification_ids
      : body.notification_id
        ? [body.notification_id]
        : [];

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }
    if (notificationIds.length === 0) {
      return NextResponse.json({ error: 'notification_id or notification_ids is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    for (const notificationId of notificationIds) {
      await db.query(
        `INSERT INTO notification_reads (user_id, company_id, notification_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, company_id, notification_id) DO NOTHING`,
        [user.id, companyId, notificationId]
      );
    }

    return NextResponse.json({ message: 'Marked as read' });
  } catch (error: any) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
