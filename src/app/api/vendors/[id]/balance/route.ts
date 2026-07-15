import { NextRequest, NextResponse } from 'next/server';
import { convertCurrency, getRatesMap } from '@/lib/exchange-rates';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const { id } = await params;

    const vendor = await db.query('SELECT company_id FROM vendors WHERE id = $1 LIMIT 1', [id]);
    if (!vendor.rowCount) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, (vendor.rows[0] as any).company_id);
    if (accessError) return accessError;

    // Get all bills for this vendor
    const bills = await db.query<{
      total: string | number;
      amount_paid: string | number;
      currency: string;
      bill_date: string;
      status: string;
    }>(
      'SELECT total, amount_paid, currency, bill_date, status FROM bills WHERE vendor_id = $1',
      [id]
    );

    // Convert each bill's outstanding balance to the company base currency
    const companyRow = await db.query<{ currency: string }>(
      'SELECT currency FROM companies WHERE id = $1',
      [(vendor.rows[0] as any).company_id]
    );
    const baseCurrency = companyRow.rows[0]?.currency || 'USD';
    const ratesMap = await getRatesMap(db, baseCurrency);

    let totalOutstanding = 0;

    for (const bill of bills.rows || []) {
      // Skip paid/void bills
      if (bill.status === 'paid' || bill.status === 'void') continue;

      const total = Number(bill.total) || 0;
      const paid = Number(bill.amount_paid) || 0;
      const remaining = total - paid;

      if (remaining <= 0) continue;

      totalOutstanding += convertCurrency(remaining, bill.currency || baseCurrency, baseCurrency, ratesMap);
    }

    return NextResponse.json({
      outstandingBalance: totalOutstanding,
      currency: baseCurrency,
    });
  } catch (error) {
    console.error('Error calculating vendor balance:', error);
    return NextResponse.json(
      { error: 'Failed to calculate vendor balance' },
      { status: 500 }
    );
  }
}
