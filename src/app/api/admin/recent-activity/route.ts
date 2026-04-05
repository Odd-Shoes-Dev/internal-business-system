import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get recent activity (last 50 items)
    const activities = await db.query(
      `SELECT al.id, al.action, al.created_at, al.metadata, c.name AS company_name
       FROM activity_logs al
       LEFT JOIN companies c ON c.id = al.company_id
       ORDER BY al.created_at DESC
       LIMIT 50`
    );

    const formattedActivities = activities.rows?.map((activity: any) => ({
      id: activity.id,
      action: activity.action,
      company_name: activity.company_name || 'Unknown',
      created_at: activity.created_at,
      metadata: activity.metadata,
    }));

    return NextResponse.json({ activities: formattedActivities || [] });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent activity' },
      { status: 500 }
    );
  }
}

