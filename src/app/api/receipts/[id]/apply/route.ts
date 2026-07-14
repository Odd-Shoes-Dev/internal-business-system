import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/receipts/[id]/apply - Apply an unapplied payment to an invoice
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;

  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const { invoice_id, amount_applied } = body;

    if (!invoice_id || !amount_applied || Number(amount_applied) <= 0) {
      return NextResponse.json(
        { error: 'invoice_id and a positive amount_applied are required' },
        { status: 400 }
      );
    }

    const paymentResult = await db.query<any>(
      'SELECT * FROM payments_received WHERE id = $1 LIMIT 1',
      [resolvedParams.id]
    );
    const payment = paymentResult.rows[0];
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    const accessError = await requireCompanyAccess(user.id, payment.company_id);
    if (accessError) return accessError;

    // How much of this payment is already applied
    const appliedResult = await db.query<{ total_applied: string }>(
      'SELECT COALESCE(SUM(amount_applied), 0)::text AS total_applied FROM payment_applications WHERE payment_id = $1',
      [resolvedParams.id]
    );
    const alreadyApplied = Number(appliedResult.rows[0]?.total_applied || 0);
    const available = Number(payment.amount) - alreadyApplied;

    if (Number(amount_applied) > available + 0.01) {
      return NextResponse.json(
        { error: `Amount exceeds available credit of ${available}` },
        { status: 400 }
      );
    }

    // Validate invoice belongs to same customer and company
    const invoiceResult = await db.query<any>(
      'SELECT id, customer_id, total, amount_paid, status FROM invoices WHERE id = $1 AND company_id = $2 LIMIT 1',
      [invoice_id, payment.company_id]
    );
    const invoice = invoiceResult.rows[0];
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    if (invoice.customer_id !== payment.customer_id) {
      return NextResponse.json(
        { error: 'Invoice does not belong to the same customer as this payment' },
        { status: 400 }
      );
    }

    if (['paid', 'void', 'cancelled'].includes(invoice.status)) {
      return NextResponse.json(
        { error: `Invoice is already ${invoice.status}` },
        { status: 400 }
      );
    }

    const invoiceBalance = Number(invoice.total) - Number(invoice.amount_paid || 0);
    if (Number(amount_applied) > invoiceBalance + 0.01) {
      return NextResponse.json(
        { error: `Amount exceeds invoice balance of ${invoiceBalance}` },
        { status: 400 }
      );
    }

    await db.transaction(async (tx) => {
      await tx.query(
        'INSERT INTO payment_applications (payment_id, invoice_id, amount_applied) VALUES ($1, $2, $3)',
        [resolvedParams.id, invoice_id, amount_applied]
      );

      const newAmountPaid = Number(invoice.amount_paid || 0) + Number(amount_applied);
      const newStatus = newAmountPaid >= Number(invoice.total) ? 'paid' : 'partial';

      await tx.query(
        'UPDATE invoices SET amount_paid = $2, status = $3::invoice_status, updated_at = NOW() WHERE id = $1',
        [invoice_id, newAmountPaid, newStatus]
      );
    });

    return NextResponse.json({ success: true, message: 'Payment applied to invoice successfully' });
  } catch (error: any) {
    console.error('Error applying payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
