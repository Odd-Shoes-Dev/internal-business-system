import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get subscription stats
    const subscriptions = await db.query<{ status: string; base_price_amount: number; currency: string }>(
      'SELECT status, base_price_amount, currency FROM subscriptions'
    );
    const rows = subscriptions.rows || [];

    const stats = {
      totalSubscriptions: rows.length,
      activeSubscriptions: rows.filter((s) => s.status === 'active').length,
      trialSubscriptions: rows.filter((s) => s.status === 'trial').length,
      expiredSubscriptions: rows.filter((s) => s.status === 'expired').length,
      pastDueSubscriptions: rows.filter((s) => s.status === 'past_due').length,
      cancelledSubscriptions: rows.filter((s) => s.status === 'cancelled').length,
      totalRevenue: 0,
      monthlyRecurringRevenue: 0,
    };

    // Calculate MRR (convert to cents)
    stats.monthlyRecurringRevenue = rows
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + (Number(s.base_price_amount || 0) * 100), 0);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching subscription stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription stats' },
      { status: 500 }
    );
  }
}
