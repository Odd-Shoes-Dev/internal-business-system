import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const { id } = await params;

    const customer = await db.query('SELECT company_id FROM customers WHERE id = $1 LIMIT 1', [id]);
    if (!customer.rowCount) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, (customer.rows[0] as any).company_id);
    if (accessError) return accessError;

    // Get all invoices for this customer
    const invoices = await db.query<{
      total: string | number;
      amount_paid: string | number;
      currency: string;
      invoice_date: string;
      status: string;
    }>(
      'SELECT total, amount_paid, currency, invoice_date, status FROM invoices WHERE customer_id = $1',
      [id]
    );

    let totalOutstanding = 0;

    // Convert each invoice's outstanding balance to USD
    for (const invoice of invoices.rows || []) {
      // Skip paid/void/cancelled invoices
      if (invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'cancelled') continue;

      const total = Number(invoice.total) || 0;
      const paid = Number(invoice.amount_paid) || 0;
      const remaining = total - paid;

      if (remaining <= 0) continue;

      let remainingInUSD = remaining;

      // Convert to USD if not already
      if (invoice.currency && invoice.currency !== 'USD') {
        const converted = await db.query<{ converted: number }>(
          'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
          [remaining, invoice.currency, 'USD', invoice.invoice_date]
        );

        remainingInUSD = converted.rows[0]?.converted ?? remaining;
      }

      totalOutstanding += remainingInUSD;
    }

    return NextResponse.json({
      outstandingBalance: totalOutstanding,
      currency: 'USD',
    });
  } catch (error) {
    console.error('Error calculating customer balance:', error);
    return NextResponse.json(
      { error: 'Failed to calculate customer balance' },
      { status: 500 }
    );
  }
}
