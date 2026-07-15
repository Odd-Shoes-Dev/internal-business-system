import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/invoices/[id]/apply-payment - Apply a payment amount to an invoice
// Updates amount_paid and status. Used when a receipt document is linked to an invoice.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id: invoiceId } = await params;
    const body = await request.json();

    if (!body.amount || Number(body.amount) <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const invoiceResult = await db.query<any>(
      'SELECT id, company_id, total, amount_paid, status FROM invoices WHERE id = $1 LIMIT 1',
      [invoiceId]
    );
    const invoice = invoiceResult.rows[0];

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, invoice.company_id);
    if (accessError) return accessError;

    if (['void', 'cancelled'].includes(invoice.status)) {
      return NextResponse.json({ error: 'Cannot apply payment to a voided or cancelled invoice' }, { status: 400 });
    }

    const balance = Number(invoice.total) - Number(invoice.amount_paid || 0);
    const amountToApply = Math.min(Number(body.amount), balance);

    if (amountToApply <= 0) {
      return NextResponse.json({ error: 'Invoice has no outstanding balance' }, { status: 400 });
    }

    const newAmountPaid = Number(invoice.amount_paid || 0) + amountToApply;
    const newStatus = newAmountPaid >= Number(invoice.total) ? 'paid' : 'partial';

    await db.query(
      'UPDATE invoices SET amount_paid = $2, status = $3, updated_at = NOW() WHERE id = $1',
      [invoiceId, newAmountPaid, newStatus]
    );

    return NextResponse.json({ success: true, amount_paid: newAmountPaid, status: newStatus });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
