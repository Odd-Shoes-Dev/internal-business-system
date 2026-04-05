import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';

// This endpoint should be protected and called by a cron job
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDbProvider();

    const now = new Date();
    const todayStr = now.toISOString();

    // Get all subscriptions where trial has expired
    const expiredTrialsResult = await db.query(
      `SELECT s.*, c.name AS company_name, c.email AS company_email
       FROM subscriptions s
       INNER JOIN companies c ON c.id = s.company_id
       WHERE s.status = 'trial'
         AND s.trial_end_date < $1`,
      [todayStr]
    );
    const expiredTrials = expiredTrialsResult.rows as any[];

    if (!expiredTrials || expiredTrials.length === 0) {
      return NextResponse.json({ 
        message: 'No expired trials found',
        processed: 0 
      });
    }

    const processed: string[] = [];
    const errors: any[] = [];

    for (const subscription of expiredTrials) {
      try {
        // Update subscription status to expired
        await db.query(
          `UPDATE subscriptions
           SET status = 'expired',
               cancellation_reason = 'trial_expired',
               cancelled_at = COALESCE(cancelled_at, $2),
               updated_at = $2
           WHERE id = $1`,
          [subscription.id, todayStr]
        );

        // Update company subscription status
        await db.query(
          `UPDATE companies
           SET subscription_status = 'expired',
               updated_at = $2
           WHERE id = $1`,
          [subscription.company_id, todayStr]
        );

        await db.query(
          `UPDATE company_settings
           SET subscription_status = 'expired',
               updated_at = $2
           WHERE company_id = $1`,
          [subscription.company_id, todayStr]
        );

        // Deactivate all trial modules
        await db.query(
          `UPDATE subscription_modules
           SET is_active = false,
               removed_at = $2,
               updated_at = $2
           WHERE company_id = $1
             AND is_trial_module = true
             AND is_active = true`,
          [subscription.company_id, todayStr]
        );

        // Create activity log
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
             $1, NULL, 'trial_expired', 'subscription', $2, $3::jsonb, NOW()
           )`,
          [
            subscription.company_id,
            subscription.id,
            JSON.stringify({
              plan_tier: subscription.plan_tier,
              trial_end_date: subscription.trial_end_date,
              expired_at: todayStr,
            }),
          ]
        );

        processed.push(subscription.company_name || subscription.company_id);

        // TODO: Send trial expired email notification
        // This would inform the user their trial has ended and encourage upgrade
        
      } catch (err: any) {
        console.error(`Error processing subscription ${subscription.id}:`, err);
        errors.push({
          company: subscription.companies?.name || subscription.company_id,
          subscription_id: subscription.id,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: processed.length,
      companies: processed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Trial expiration cron job error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process trial expirations' },
      { status: 500 }
    );
  }
}

// GET for testing
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    message: 'Trial expiration cron job endpoint',
    usage: 'POST to this endpoint with Authorization: Bearer <CRON_SECRET>',
    schedule: 'Run daily at 0:00 AM UTC',
  });
}
