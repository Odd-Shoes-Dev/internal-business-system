import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/bookings/stats - Get booking statistics
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

    const bookingsResult = await db.query(
      `SELECT status, total, amount_paid, balance_due
       FROM bookings
       WHERE company_id = $1`,
      [companyId]
    );

    const bookings = bookingsResult.rows;

    const stats = {
      totalBookings: bookings.length,
      confirmed: bookings.filter((b: any) => b.status === 'confirmed').length,
      pending: bookings.filter((b: any) => b.status === 'pending').length,
      completed: bookings.filter((b: any) => b.status === 'completed').length,
      cancelled: bookings.filter((b: any) => b.status === 'cancelled').length,
      totalRevenue: bookings.reduce((sum: number, b: any) => sum + Number(b.total || 0), 0),
      totalPaid: bookings.reduce((sum: number, b: any) => sum + Number(b.amount_paid || 0), 0),
      totalOutstanding: bookings.reduce((sum: number, b: any) => sum + Number(b.balance_due || 0), 0),
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
