import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';
import { sendTrialReminderEmail, formatCurrencyForEmail } from '@/lib/email/send';

// This endpoint should be protected and called by a cron job
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDbProvider();

    const subscriptionsResult = await db.query(
      `SELECT s.*, c.name AS company_name, c.email AS company_email
       FROM subscriptions s
       INNER JOIN companies c ON c.id = s.company_id
       WHERE s.status = 'trial'
         AND s.trial_end_date IS NOT NULL`
    );
    const subscriptions = subscriptionsResult.rows as any[];

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No trial subscriptions found' });
    }

    const now = new Date();
    const emailsSent: string[] = [];
    const errors: any[] = [];

    for (const subscription of subscriptions) {
      try {
        const trialEnd = new Date(subscription.trial_end_date);
        const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Send reminders at 7, 3, and 1 days
        if (![7, 3, 1].includes(daysRemaining)) {
          continue;
        }

        if (!subscription.company_email) {
          console.log(`No email for company: ${subscription.company_id}`);
          continue;
        }

        // Check if we already sent a reminder today
        const today = now.toISOString().split('T')[0];
        const existingLogResult = await db.query(
          `SELECT id
           FROM email_logs
           WHERE company_id = $1
             AND email_type = 'trial_reminder'
             AND sent_at >= $2::date
           LIMIT 1`,
          [subscription.company_id, today]
        );
        const existingLog = existingLogResult.rows[0];

        if (existingLog) {
          console.log(`Already sent reminder today for company: ${subscription.company_id}`);
          continue;
        }

        const planName = subscription.plan_tier.charAt(0).toUpperCase() + subscription.plan_tier.slice(1);
        const monthlyPrice = formatCurrencyForEmail(
          subscription.base_price_amount * 100,
          subscription.currency
        );

        const result = await sendTrialReminderEmail({
          to: subscription.company_email,
          companyName: subscription.company_name,
          daysRemaining,
          planName,
          monthlyPrice,
        });

        if (result.success) {
          emailsSent.push(subscription.company_email);

          // Log the email
          await db.query(
            `INSERT INTO email_logs (
               company_id,
               email_type,
               recipient,
               subject,
               sent_at,
               external_id,
               status
             ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              subscription.company_id,
              'trial_reminder',
              subscription.company_email,
              `Your BlueOx trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
              now.toISOString(),
              result.id || null,
              'sent',
            ]
          );
        } else {
          errors.push({
            company: subscription.company_name,
            error: result.error,
          });
        }
      } catch (err: any) {
        console.error(`Error processing subscription ${subscription.id}:`, err);
        errors.push({
          company: subscription.companies?.name || subscription.company_id,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      emailsSent: emailsSent.length,
      emails: emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process trial reminders' },
      { status: 500 }
    );
  }
}

// Optionally support GET for testing
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    message: 'Trial reminder cron job endpoint',
    usage: 'POST to this endpoint with Authorization: Bearer <CRON_SECRET>',
    schedule: 'Run daily at 9:00 AM UTC',
  });
}
