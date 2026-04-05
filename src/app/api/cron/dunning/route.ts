import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';
import { getStripe } from '@/lib/stripe';

// This endpoint handles dunning (failed payment retries)
export async function POST(request: NextRequest) {
  try {
    const stripe = await getStripe();
    
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDbProvider();

    const now = new Date();

    // Get all past_due subscriptions
    const pastDueResult = await db.query(
      `SELECT s.*, c.name AS company_name, c.email AS company_email,
              cs.stripe_subscription_id
       FROM subscriptions s
       INNER JOIN companies c ON c.id = s.company_id
       LEFT JOIN company_settings cs ON cs.company_id = s.company_id
       WHERE s.status = 'past_due'`
    );
    const pastDueSubscriptions = pastDueResult.rows as any[];

    if (!pastDueSubscriptions || pastDueSubscriptions.length === 0) {
      return NextResponse.json({ 
        message: 'No past_due subscriptions found',
        processed: 0 
      });
    }

    const retried: string[] = [];
    const cancelled: string[] = [];
    const errors: any[] = [];

    for (const subscription of pastDueSubscriptions) {
      try {
        const stripeSubId = subscription.stripe_subscription_id;
        
        if (!stripeSubId) {
          console.log(`No Stripe subscription for company ${subscription.company_id}`);
          continue;
        }

        // Get Stripe subscription to check retry count
        const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubId);

        // Check if we've exceeded max retries (default: 4 attempts over ~2 weeks)
        const metadata = stripeSubscription.metadata || {};
        const retryCount = parseInt(metadata.retry_count || '0');
        const maxRetries = 4;

        if (retryCount >= maxRetries) {
          // Cancel subscription after max retries
          await stripe.subscriptions.update(stripeSubId, {
            cancel_at_period_end: true,
            metadata: {
              ...metadata,
              cancelled_reason: 'payment_failed_max_retries',
              cancelled_at: now.toISOString(),
            },
          });

          // Update database
          await db.query(
            `UPDATE subscriptions
             SET status = 'cancelled',
                 cancellation_reason = 'payment_failed',
                 cancelled_at = $2,
                 updated_at = $2
             WHERE id = $1`,
            [subscription.id, now.toISOString()]
          );

          await db.query(
            `UPDATE companies
             SET subscription_status = 'cancelled',
                 updated_at = $2
             WHERE id = $1`,
            [subscription.company_id, now.toISOString()]
          );

          await db.query(
            `UPDATE company_settings
             SET subscription_status = 'cancelled',
                 updated_at = $2
             WHERE company_id = $1`,
            [subscription.company_id, now.toISOString()]
          );

          // Log activity
          await db.query(
            `INSERT INTO activity_logs (
               company_id,
               user_id,
               action,
               entity_type,
               entity_id,
               metadata,
               created_at
             ) VALUES (
               $1, NULL, 'subscription_cancelled', 'subscription', $2, $3::jsonb, NOW()
             )`,
            [
              subscription.company_id,
              subscription.id,
              JSON.stringify({
                reason: 'payment_failed_max_retries',
                retry_count: retryCount,
                plan_tier: subscription.plan_tier,
              }),
            ]
          );

          cancelled.push(subscription.company_name || subscription.company_id);

          // TODO: Send subscription cancelled email
          
        } else {
          // Attempt to retry payment
          try {
            // Get the latest invoice
            const invoices = await stripe.invoices.list({
              subscription: stripeSubId,
              limit: 1,
              status: 'open',
            });

            if (invoices.data.length > 0) {
              const invoice = invoices.data[0];
              
              // Retry payment
              await stripe.invoices.pay(invoice.id);

              // Update retry count
              await stripe.subscriptions.update(stripeSubId, {
                metadata: {
                  ...metadata,
                  retry_count: (retryCount + 1).toString(),
                  last_retry_at: now.toISOString(),
                },
              });

              retried.push(subscription.company_name || subscription.company_id);

              // Log activity
              await db.query(
                `INSERT INTO activity_logs (
                   company_id,
                   user_id,
                   action,
                   entity_type,
                   entity_id,
                   metadata,
                   created_at
                 ) VALUES (
                   $1, NULL, 'payment_retry', 'subscription', $2, $3::jsonb, NOW()
                 )`,
                [
                  subscription.company_id,
                  subscription.id,
                  JSON.stringify({
                    retry_count: retryCount + 1,
                    invoice_id: invoice.id,
                  }),
                ]
              );
            }
          } catch (paymentError: any) {
            console.error(`Payment retry failed for ${subscription.company_id}:`, paymentError.message);
            
            // Update retry count even if payment failed
            await stripe.subscriptions.update(stripeSubId, {
              metadata: {
                ...metadata,
                retry_count: (retryCount + 1).toString(),
                last_retry_at: now.toISOString(),
                last_error: paymentError.message,
              },
            });

            errors.push({
              company: subscription.company_name || subscription.company_id,
              error: paymentError.message,
              retry_count: retryCount + 1,
            });
          }
        }
      } catch (err: any) {
        console.error(`Error processing subscription ${subscription.id}:`, err);
        errors.push({
          company: subscription.company_name || subscription.company_id,
          subscription_id: subscription.id,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      retried: retried.length,
      retriedCompanies: retried,
      cancelled: cancelled.length,
      cancelledCompanies: cancelled,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Dunning cron job error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process dunning' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    message: 'Dunning management cron job endpoint',
    usage: 'POST to this endpoint with Authorization: Bearer <CRON_SECRET>',
    schedule: 'Run every 3 days',
    description: 'Retries failed payments and cancels subscriptions after max retries',
  });
}
