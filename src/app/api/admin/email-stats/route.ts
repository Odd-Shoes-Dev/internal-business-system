import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get email stats for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const emails = await db.query<{ email_type: string | null; status: string | null }>(
      'SELECT email_type, status FROM email_logs WHERE sent_at >= $1',
      [thirtyDaysAgo.toISOString()]
    );
    const rows = emails.rows || [];

    const stats = {
      total: rows.length,
      sent: rows.filter((e) => e.status === 'sent').length,
      failed: rows.filter((e) => e.status === 'failed').length,
      types: {} as { [key: string]: number },
    };

    // Count by type
    rows.forEach((email) => {
      const type = email.email_type || 'unknown';
      stats.types[type] = (stats.types[type] || 0) + 1;
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching email stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email stats' },
      { status: 500 }
    );
  }
}
