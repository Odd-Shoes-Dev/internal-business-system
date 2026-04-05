import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/receipts/:id/payment - Record additional payment for receipt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id: receiptId } = await params;
    const body = await request.json();

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      );
    }

    // Get current receipt
    const receiptResult = await db.query<any>(
      `SELECT *
       FROM invoices
       WHERE id = $1
         AND document_type = 'receipt'
       LIMIT 1`,
      [receiptId]
    );
    const receipt = receiptResult.rows[0];

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, receipt.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Calculate balance due
    const currentAmountPaid = parseFloat(receipt.amount_paid || 0);
    const total = parseFloat(receipt.total || 0);
    const balanceDue = Math.round((total - currentAmountPaid) * 100) / 100;

    if (body.amount > balanceDue + 0.01) { // Allow small rounding tolerance
      return NextResponse.json(
        { error: `Payment amount cannot exceed balance due of ${balanceDue}` },
        { status: 400 }
      );
    }

    // Update receipt amount_paid
    const newAmountPaid = Math.round((currentAmountPaid + body.amount) * 100) / 100;
    const newStatus = newAmountPaid >= total - 0.01 ? 'paid' : 'partial'; // Allow small tolerance for "paid" status

    await db.query(
      `UPDATE invoices
       SET amount_paid = $2,
           status = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [receiptId, newAmountPaid, newStatus]
    );

    // Optionally record payment in payments_received for audit trail
    try {
      const date = new Date();
      const paymentNumber = `PMT-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      await db.query(
        `INSERT INTO payments_received (
           company_id, payment_number, customer_id, payment_date, amount,
           payment_method, reference_number, notes, currency, created_by
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10
         )`,
        [
          receipt.company_id,
          paymentNumber,
          receipt.customer_id,
          new Date().toISOString().split('T')[0],
          body.amount,
          body.payment_method || 'cash',
          `Receipt ${receipt.receipt_number}`,
          body.notes || `Additional payment for receipt ${receipt.receipt_number}`,
          receipt.currency || 'USD',
          user.id,
        ]
      );
    } catch (error) {
      console.error('Failed to record payment in payments_received:', error);
      // Don't fail the operation if audit trail fails
    }

    return NextResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      amount_paid: newAmountPaid,
      status: newStatus,
    });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
