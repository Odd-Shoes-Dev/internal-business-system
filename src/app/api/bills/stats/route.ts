import { NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function GET() {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const userCompany = await db.query<{ company_id: string }>(
      `SELECT company_id
       FROM user_companies
       WHERE user_id = $1
       ORDER BY is_primary DESC, joined_at ASC
       LIMIT 1`,
      [user.id]
    );

    if (!userCompany.rowCount) {
      return NextResponse.json({ error: 'No company found for user' }, { status: 403 });
    }

    const companyId = userCompany.rows[0].company_id;

    // Fetch all bills with their currencies
    const bills = await db.query<{
      total: number;
      amount_paid: number;
      due_date: string;
      status: string;
      currency: string;
      bill_date: string;
    }>(
      `SELECT total, amount_paid, due_date, status, currency, bill_date
       FROM bills
       WHERE company_id = $1`,
      [companyId]
    );

    if (!bills.rows || bills.rows.length === 0) {
      return NextResponse.json({
        totalUnpaid: 0,
        dueThisWeek: 0,
        overdue: 0,
        paidThisMonth: 0,
      });
    }

    const now = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Convert all amounts to USD
    let totalUnpaid = 0;
    let dueThisWeek = 0;
    let overdue = 0;
    let paidThisMonth = 0;

    for (const bill of bills.rows) {
      const remaining = bill.total - (bill.amount_paid || 0);
      const dueDate = new Date(bill.due_date);
      const billDate = new Date(bill.bill_date);

      // Convert to USD
      let amountInUSD = bill.total;
      let remainingInUSD = remaining;

      if (bill.currency !== 'USD') {
        const convertedTotal = await db.query<{ converted: number | null }>(
          'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
          [bill.total, bill.currency, 'USD', bill.bill_date]
        );

        const convertedRemaining = await db.query<{ converted: number | null }>(
          'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
          [remaining, bill.currency, 'USD', bill.bill_date]
        );

        amountInUSD = convertedTotal.rows[0]?.converted || bill.total;
        remainingInUSD = convertedRemaining.rows[0]?.converted || remaining;
      }

      // Calculate totals in USD
      if (bill.status !== 'paid' && bill.status !== 'void') {
        totalUnpaid += remainingInUSD;

        if (dueDate >= now && dueDate <= weekFromNow) {
          dueThisWeek += remainingInUSD;
        }

        if (dueDate < now) {
          overdue += remainingInUSD;
        }
      }

      if (bill.status === 'paid' && billDate >= startOfMonth) {
        paidThisMonth += amountInUSD;
      }
    }

    return NextResponse.json({
      totalUnpaid,
      dueThisWeek,
      overdue,
      paidThisMonth,
    });
  } catch (error: any) {
    console.error('Failed to calculate bill stats:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
