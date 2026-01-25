import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

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

    const supabase = await createClient();

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata.invoice_id;

        if (invoiceId) {
          // Fetch the invoice
          const { data: invoice } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', invoiceId)
            .single();

          if (invoice) {
            const paymentAmount = paymentIntent.amount / 100; // Convert from cents
            const newAmountPaid = (invoice.amount_paid || 0) + paymentAmount;
            const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partial';

            // Update invoice
            await supabase
              .from('invoices')
              .update({
                amount_paid: newAmountPaid,
                status: newStatus,
                paid_date: newStatus === 'paid' ? new Date().toISOString() : null,
              })
              .eq('id', invoiceId);

            // Create payment record
            const { data: payment } = await supabase.from('payments_received').insert([
              {
                customer_id: invoice.customer_id,
                payment_date: new Date().toISOString().split('T')[0],
                amount: paymentAmount,
                payment_method: 'stripe',
                reference_number: paymentIntent.id,
                notes: `Stripe payment: ${paymentIntent.id}`,
              },
            ]).select().single();

            // Create payment application
            await supabase.from('payment_applications').insert([
              {
                payment_id: payment.id,
                invoice_id: invoiceId,
                amount_applied: paymentAmount,
              },
            ]);

            // Create journal entry for the payment
            const { data: journalEntry } = await supabase
              .from('journal_entries')
              .insert([
                {
                  entry_date: new Date().toISOString().split('T')[0],
                  description: `Payment received for Invoice ${invoice.invoice_number}`,
                  source_module: 'stripe_payment',
                  source_document_id: invoiceId,
                  status: 'posted',
                },
              ])
              .select()
              .single();

            if (journalEntry) {
              // Debit Cash/Bank, Credit Accounts Receivable
              await supabase.from('journal_lines').insert([
                {
                  journal_entry_id: journalEntry.id,
                  account_id: '1010', // Cash account
                  debit: paymentAmount,
                  credit: 0,
                  description: 'Payment received',
                },
                {
                  journal_entry_id: journalEntry.id,
                  account_id: '1200', // Accounts Receivable
                  debit: 0,
                  credit: paymentAmount,
                  description: 'Payment received',
                },
              ]);
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
          
          // You could update the invoice with a failed payment note
          // or send a notification to the business owner
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoice_id;

        if (invoiceId && session.payment_status === 'paid') {
          // Similar logic to payment_intent.succeeded
          const { data: invoice } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', invoiceId)
            .single();

          if (invoice) {
            const paymentAmount = (session.amount_total || 0) / 100;
            const newAmountPaid = (invoice.amount_paid || 0) + paymentAmount;
            const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partial';

            await supabase
              .from('invoices')
              .update({
                amount_paid: newAmountPaid,
                status: newStatus,
                paid_date: newStatus === 'paid' ? new Date().toISOString() : null,
              })
              .eq('id', invoiceId);

            // Create payment record
            const { data: payment } = await supabase.from('payments_received').insert([
              {
                customer_id: invoice.customer_id,
                payment_date: new Date().toISOString().split('T')[0],
                amount: paymentAmount,
                payment_method: 'stripe',
                reference_number: session.payment_intent as string,
                notes: `Stripe checkout: ${session.id}`,
              },
            ]).select().single();

            // Create payment application
            await supabase.from('payment_applications').insert([
              {
                payment_id: payment.id,
                invoice_id: invoiceId,
                amount_applied: paymentAmount,
              },
            ]);
          }
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        // Find invoice with this payment intent
        const { data: invoice } = await supabase
          .from('invoices')
          .select('*')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .single();

        if (invoice) {
          const refundAmount = (charge.amount_refunded || 0) / 100;
          const newAmountPaid = Math.max(0, (invoice.amount_paid || 0) - refundAmount);
          const newStatus = newAmountPaid === 0 ? 'sent' : newAmountPaid < invoice.total ? 'partial' : 'paid';

          await supabase
            .from('invoices')
            .update({
              amount_paid: newAmountPaid,
              status: newStatus,
            })
            .eq('id', invoice.id);

          // Create refund record
          const { data: refundPayment } = await supabase.from('payments_received').insert([
            {
              customer_id: invoice.customer_id,
              amount: -refundAmount, // Negative for refund
              payment_date: new Date().toISOString().split('T')[0],
              payment_method: 'stripe_refund',
              reference: charge.id,
              notes: `Refund: ${charge.id}`,
            },
          ]);
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
