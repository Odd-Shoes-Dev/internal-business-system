import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent, createCheckoutSession } from '@/lib/stripe';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const { invoiceId, method } = body;

    // Fetch the invoice
    const invoiceResult = await db.query(
      `SELECT i.*,
              c.id AS customer_id_join,
              c.name AS customer_name,
              c.email AS customer_email,
              c.stripe_customer_id AS customer_stripe_customer_id
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.id = $1
       LIMIT 1`,
      [invoiceId]
    );
    const invoice = invoiceResult.rows[0] as any;

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.company_id) {
      return NextResponse.json({ error: 'Invoice is missing company_id' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, invoice.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Calculate amount due in cents
    const amountDue = Math.round((invoice.total - (invoice.amount_paid || 0)) * 100);

    if (amountDue <= 0) {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 });
    }

    if (method === 'checkout') {
      // Create a Stripe Checkout session
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      const session = await createCheckoutSession({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        amount: amountDue,
        customerEmail: invoice.customer_email || '',
        successUrl: `${baseUrl}/pay/success?invoice=${invoice.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/pay/cancel?invoice=${invoice.id}`,
      });

      return NextResponse.json({
        sessionId: session.id,
        url: session.url,
      });
    } else {
      // Create a Payment Intent for embedded payment
      const { clientSecret, paymentIntentId } = await createPaymentIntent({
        amount: amountDue,
        currency: 'usd',
        customerId: invoice.customer_stripe_customer_id,
        invoiceId: invoice.id,
        description: `Payment for Invoice ${invoice.invoice_number}`,
        metadata: {
          customer_id: invoice.customer_id,
          customer_name: invoice.customer_name || '',
        },
      });

      // Store the payment intent ID on the invoice
      await db.query(
        `UPDATE invoices
         SET stripe_payment_intent_id = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [invoiceId, paymentIntentId]
      );

      return NextResponse.json({
        clientSecret,
        paymentIntentId,
        amount: amountDue,
      });
    }
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
