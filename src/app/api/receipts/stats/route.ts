import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    // Get user's company
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

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');

    const params: any[] = [companyId];
    let whereSql = 'WHERE company_id = $1 AND status <> \'void\'';

    if (customerId) {
      params.push(customerId);
      whereSql += ` AND customer_id = $${params.length}`;
    }

    const receipts = await db.query<{
      total: number | string;
      amount_paid: number | string;
      currency: string;
      invoice_date: string;
      status: string;
      document_type: string;
    }>(
      `SELECT total, amount_paid, currency, invoice_date, status, document_type
       FROM invoices
       ${whereSql}`,
      params
    );

    let totalAmount = 0;
    let thisMonthCount = 0;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const receipt of receipts.rows || []) {
      // Only count receipts (document_type === 'receipt')
      if (receipt.document_type !== 'receipt') continue;

      const amountPaid = Number(receipt.amount_paid) || Number(receipt.total) || 0;
      let amountUSD = amountPaid;

      // Convert to USD if not already
      if (receipt.currency && receipt.currency !== 'USD') {
        const converted = await db.query<{ converted: number | null }>(
          'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
          [amountPaid, receipt.currency, 'USD', receipt.invoice_date]
        );
        amountUSD = converted.rows[0]?.converted || amountPaid;
      }

      totalAmount += amountUSD;

      // Count this month receipts
      const receiptDate = new Date(receipt.invoice_date);
      if (receiptDate >= firstDayOfMonth) {
        thisMonthCount++;
      }
    }

    return NextResponse.json({
      totalAmount,
      totalCount: receipts.rows?.filter((r) => r.document_type === 'receipt').length || 0,
      thisMonthCount,
    });
  } catch (error) {
    console.error('Error calculating receipts stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate receipts stats' },
      { status: 500 }
    );
  }
}
