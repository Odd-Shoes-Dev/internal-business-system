import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/stripe';
import { getDbProvider } from '@/lib/provider';
import Stripe from 'stripe';
import {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  formatCurrencyForEmail,
  formatDateForEmail,
  getRetryDate,
} from '@/lib/email/send';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    
    let event: Stripe.Event;
    try {
      event = await verifyWebhookSignature(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const db = getDbProvider();

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata.invoice_id;

        if (invoiceId) {
          // Fetch the invoice
          const invoiceResult = await db.query(
            'SELECT * FROM invoices WHERE id = $1 LIMIT 1',
            [invoiceId]
          );
          const invoice = invoiceResult.rows[0] as any;

          if (invoice) {
            const paymentAmount = paymentIntent.amount / 100; // Convert from cents
            const newAmountPaid = (invoice.amount_paid || 0) + paymentAmount;
            const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partial';

            // Update invoice
            await db.query(
              `UPDATE invoices
               SET amount_paid = $2,
                   status = $3,
                   paid_date = $4,
                   updated_at = NOW()
               WHERE id = $1`,
              [invoiceId, newAmountPaid, newStatus, newStatus === 'paid' ? new Date().toISOString() : null]
            );

            const paymentNumberResult = await db.query('SELECT generate_payment_number() AS payment_number');
            const paymentNumber = paymentNumberResult.rows[0]?.payment_number;

            // Create payment record
            const paymentResult = await db.query(
              `INSERT INTO payments_received (
                 company_id,
                 payment_number,
                 customer_id,
                 payment_date,
                 amount,
                 payment_method,
                 reference_number,
                 stripe_payment_id,
                 notes,
                 created_at
               ) VALUES (
                 $1, $2, $3, CURRENT_DATE, $4, 'stripe', $5, $5, $6, NOW()
               )
               RETURNING id`,
              [
                invoice.company_id || null,
                paymentNumber || `PMT-STRIPE-${Date.now()}`,
                invoice.customer_id,
                paymentAmount,
                paymentIntent.id,
                `Stripe payment: ${paymentIntent.id}`,
              ]
            );
            const payment = paymentResult.rows[0] as any;

            // Create payment application
            await db.query(
              `INSERT INTO payment_applications (
                 payment_id,
                 invoice_id,
                 amount_applied,
                 created_at
               ) VALUES ($1, $2, $3, NOW())`,
              [payment.id, invoiceId, paymentAmount]
            );

            // Create journal entry for the payment
            const cashAccountResult = await db.query(
              `SELECT id
               FROM accounts
               WHERE code = '1010'
                 AND (company_id = $1 OR company_id IS NULL)
               ORDER BY CASE WHEN company_id = $1 THEN 0 ELSE 1 END
               LIMIT 1`,
              [invoice.company_id || null]
            );
            const arAccountResult = await db.query(
              `SELECT id
               FROM accounts
               WHERE code = '1200'
                 AND (company_id = $1 OR company_id IS NULL)
               ORDER BY CASE WHEN company_id = $1 THEN 0 ELSE 1 END
               LIMIT 1`,
              [invoice.company_id || null]
            );

            if (cashAccountResult.rows[0] && arAccountResult.rows[0]) {
              const entryNumberResult = await db.query('SELECT generate_journal_entry_number() AS entry_number');
              const entryNumber = entryNumberResult.rows[0]?.entry_number;

              const journalEntryResult = await db.query(
                `INSERT INTO journal_entries (
                   company_id,
                   entry_number,
                   entry_date,
                   description,
                   source_module,
                   source_document_id,
                   status,
                   created_at
                 ) VALUES (
                   $1, $2, CURRENT_DATE, $3, 'stripe_payment', $4, 'posted', NOW()
                 )
                 RETURNING id`,
                [
                  invoice.company_id || null,
                  entryNumber,
                  `Payment received for Invoice ${invoice.invoice_number}`,
                  invoiceId,
                ]
              );
              const journalEntry = journalEntryResult.rows[0] as any;

              // Debit Cash/Bank, Credit Accounts Receivable
              await db.query(
                `INSERT INTO journal_lines (
                   company_id,
                   journal_entry_id,
                   line_number,
                   account_id,
                   debit,
                   credit,
                   base_debit,
                   base_credit,
                   description,
                   created_at
                 ) VALUES
                   ($1, $2, 1, $3, $4, 0, $4, 0, 'Payment received', NOW()),
                   ($1, $2, 2, $5, 0, $4, 0, $4, 'Payment received', NOW())`,
                [
                  invoice.company_id || null,
                  journalEntry.id,
                  cashAccountResult.rows[0].id,
                  paymentAmount,
                  arAccountResult.rows[0].id,
                ]
              );
            }

            // Send payment success email
            try {
              const companyResult = await db.query(
                'SELECT name, email FROM companies WHERE id = $1 LIMIT 1',
                [invoice.company_id]
              );
              const company = companyResult.rows[0] as any;

              if (company?.email) {
                await sendPaymentSuccessEmail({
                  to: company.email,
                  companyName: company.name,
                  planName: 'Invoice Payment',
                  amount: formatCurrencyForEmail(paymentIntent.amount, paymentIntent.currency),
                  invoiceNumber: invoice.invoice_number,
                  billingPeriodStart: formatDateForEmail(invoice.invoice_date),
                  billingPeriodEnd: formatDateForEmail(invoice.due_date),
                });
              }
            } catch (emailError) {
              console.error('Failed to send payment success email:', emailError);
            }
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata.invoice_id;

        if (invoiceId) {
          // Log the failed payment attempt
          console.log(`Payment failed for invoice ${invoiceId}: ${paymentIntent.last_payment_error?.message}`);
          
          // Send payment failed email
          try {
            const invoiceResult = await db.query(
              `SELECT i.*, c.name AS company_name, c.email AS company_email
               FROM invoices i
               LEFT JOIN companies c ON c.id = i.company_id
               WHERE i.id = $1
               LIMIT 1`,
              [invoiceId]
            );
            const invoice = invoiceResult.rows[0] as any;

            if (invoice?.company_email) {
              await sendPaymentFailedEmail({
                to: invoice.company_email,
                companyName: invoice.company_name,
                planName: 'Invoice Payment',
                amount: formatCurrencyForEmail(paymentIntent.amount, paymentIntent.currency),
                failureReason: paymentIntent.last_payment_error?.message,
                retryDate: getRetryDate(),
              });
            }
          } catch (emailError) {
            console.error('Failed to send payment failed email:', emailError);
          }
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoice_id;

        if (invoiceId && session.payment_status === 'paid') {
          // Similar logic to payment_intent.succeeded
          const invoiceResult = await db.query(
            'SELECT * FROM invoices WHERE id = $1 LIMIT 1',
            [invoiceId]
          );
          const invoice = invoiceResult.rows[0] as any;

          if (invoice) {
            const paymentAmount = (session.amount_total || 0) / 100;
            const newAmountPaid = (invoice.amount_paid || 0) + paymentAmount;
            const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partial';

            await db.query(
              `UPDATE invoices
               SET amount_paid = $2,
                   status = $3,
                   paid_date = $4,
                   updated_at = NOW()
               WHERE id = $1`,
              [invoiceId, newAmountPaid, newStatus, newStatus === 'paid' ? new Date().toISOString() : null]
            );

            const paymentNumberResult = await db.query('SELECT generate_payment_number() AS payment_number');
            const paymentNumber = paymentNumberResult.rows[0]?.payment_number;

            // Create payment record
            const paymentResult = await db.query(
              `INSERT INTO payments_received (
                 company_id,
                 payment_number,
                 customer_id,
                 payment_date,
                 amount,
                 payment_method,
                 reference_number,
                 stripe_payment_id,
                 notes,
                 created_at
               ) VALUES (
                 $1, $2, $3, CURRENT_DATE, $4, 'stripe', $5, $5, $6, NOW()
               )
               RETURNING id`,
              [
                invoice.company_id || null,
                paymentNumber || `PMT-STRIPE-${Date.now()}`,
                invoice.customer_id,
                paymentAmount,
                session.payment_intent as string,
                `Stripe checkout: ${session.id}`,
              ]
            );
            const payment = paymentResult.rows[0] as any;

            // Create payment application
            await db.query(
              `INSERT INTO payment_applications (
                 payment_id,
                 invoice_id,
                 amount_applied,
                 created_at
               ) VALUES ($1, $2, $3, NOW())`,
              [payment.id, invoiceId, paymentAmount]
            );
          }
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        // Find invoice with this payment intent
        const invoiceResult = await db.query(
          'SELECT * FROM invoices WHERE stripe_payment_intent_id = $1 LIMIT 1',
          [paymentIntentId]
        );
        const invoice = invoiceResult.rows[0] as any;

        if (invoice) {
          const refundAmount = (charge.amount_refunded || 0) / 100;
          const newAmountPaid = Math.max(0, (invoice.amount_paid || 0) - refundAmount);
          const newStatus = newAmountPaid === 0 ? 'sent' : newAmountPaid < invoice.total ? 'partial' : 'paid';

          await db.query(
            `UPDATE invoices
             SET amount_paid = $2,
                 status = $3,
                 updated_at = NOW()
             WHERE id = $1`,
            [invoice.id, newAmountPaid, newStatus]
          );

          const paymentNumberResult = await db.query('SELECT generate_payment_number() AS payment_number');
          const paymentNumber = paymentNumberResult.rows[0]?.payment_number;

          // Create refund record
          await db.query(
            `INSERT INTO payments_received (
               company_id,
               payment_number,
               customer_id,
               amount,
               payment_date,
               payment_method,
               reference_number,
               stripe_charge_id,
               notes,
               created_at
             ) VALUES (
               $1, $2, $3, $4, CURRENT_DATE, 'stripe', $5, $5, $6, NOW()
             )`,
            [
              invoice.company_id || null,
              paymentNumber || `PMT-REF-${Date.now()}`,
              invoice.customer_id,
              -refundAmount,
              charge.id,
              `Refund: ${charge.id}`,
            ]
          );
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Disable body parsing, we need the raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
