import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';

// This endpoint cleans up cancelled/expired subscriptions after grace period
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDbProvider();

    const now = new Date();
    const gracePeriodDays = 30; // Keep data for 30 days after cancellation/expiration
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);
    const cutoffStr = cutoffDate.toISOString();

    const results = {
      deactivatedModules: 0,
      archivedSubscriptions: 0,
      warned: [] as string[],
      errors: [] as any[],
    };

    // Step 1: Deactivate modules for cancelled/expired subscriptions past grace period
    const oldSubscriptionsResult = await db.query(
      `SELECT s.id, s.company_id, s.status, s.cancelled_at, c.name AS company_name
       FROM subscriptions s
       INNER JOIN companies c ON c.id = s.company_id
       WHERE s.status IN ('cancelled', 'expired')
         AND s.is_archived = false
         AND (s.cancelled_at < $1 OR s.updated_at < $1)`,
      [cutoffStr]
    );
    const oldSubscriptions = oldSubscriptionsResult.rows as any[];

    if (oldSubscriptions && oldSubscriptions.length > 0) {
      for (const subscription of oldSubscriptions) {
        try {
          // Deactivate all modules
          await db.query(
            `UPDATE subscription_modules
             SET is_active = false,
                 removed_at = $2,
                 updated_at = $2
             WHERE company_id = $1
               AND is_active = true`,
            [subscription.company_id, now.toISOString()]
          );

          results.deactivatedModules += 1;

          // Mark subscription as archived
          await db.query(
            `UPDATE subscriptions
             SET is_archived = true,
                 updated_at = $2
             WHERE id = $1`,
            [subscription.id, now.toISOString()]
          );

          results.archivedSubscriptions += 1;

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
               $1, NULL, 'subscription_archived', 'subscription', $2, $3::jsonb, NOW()
             )`,
            [
              subscription.company_id,
              subscription.id,
              JSON.stringify({
                status: subscription.status,
                archived_at: now.toISOString(),
                grace_period_days: gracePeriodDays,
              }),
            ]
          );

        } catch (err: any) {
          console.error(`Error archiving subscription ${subscription.id}:`, err);
          results.errors.push({
            company: subscription.company_name,
            subscription_id: subscription.id,
            error: err.message,
          });
        }
      }
    }

    // Step 2: Warn companies approaching grace period end (3 days before)
    const warnDate = new Date(now);
    warnDate.setDate(warnDate.getDate() - (gracePeriodDays - 3)); // 27 days ago
    const warnDateStr = warnDate.toISOString();

    const warningSubscriptionsResult = await db.query(
      `SELECT s.id, s.company_id, s.status, c.name AS company_name, c.email AS company_email
       FROM subscriptions s
       INNER JOIN companies c ON c.id = s.company_id
       WHERE s.status IN ('cancelled', 'expired')
         AND s.cancelled_at < $1
         AND s.cancelled_at > $2
         AND s.is_archived = false`,
      [warnDateStr, cutoffStr]
    );
    const warningSubscriptions = warningSubscriptionsResult.rows as any[];

    if (warningSubscriptions && warningSubscriptions.length > 0) {
      for (const subscription of warningSubscriptions) {
        // Check if we already sent a warning
        const existingWarningResult = await db.query(
          `SELECT id
           FROM email_logs
           WHERE company_id = $1
             AND email_type = 'data_deletion_warning'
             AND sent_at >= $2
           LIMIT 1`,
          [subscription.company_id, cutoffStr]
        );
        const existingWarning = existingWarningResult.rows[0];

        if (!existingWarning && subscription.company_email) {
          results.warned.push(subscription.company_name || subscription.company_id);

          // TODO: Send warning email about upcoming data deletion
          // For now, just log the activity
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
               $1, NULL, 'grace_period_warning', 'subscription', $2, $3::jsonb, NOW()
             )`,
            [
              subscription.company_id,
              subscription.id,
              JSON.stringify({
                days_remaining: 3,
                deletion_date: cutoffDate.toISOString(),
              }),
            ]
          );
        }
      }
    }

    // Step 3: Clean up old activity logs (optional - keep for 1 year)
    const activityCutoff = new Date(now);
    activityCutoff.setFullYear(activityCutoff.getFullYear() - 1);
    
    try {
      await db.query(
        `DELETE FROM activity_logs
         WHERE created_at < $1
           AND action NOT IN ('subscription_created', 'subscription_cancelled', 'payment_failed')`,
        [activityCutoff.toISOString()]
      );
    } catch (logCleanupError) {
      console.error('Error cleaning up activity logs:', logCleanupError);
    }

    return NextResponse.json({
      success: true,
      deactivatedModules: results.deactivatedModules,
      archivedSubscriptions: results.archivedSubscriptions,
      warned: results.warned.length,
      warnedCompanies: results.warned,
      gracePeriodDays,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error: any) {
    console.error('Cleanup cron job error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process cleanup' },
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
    message: 'Subscription cleanup cron job endpoint',
    usage: 'POST to this endpoint with Authorization: Bearer <CRON_SECRET>',
    schedule: 'Run daily at 2:00 AM UTC',
    description: 'Archives old subscriptions and warns about data deletion',
    gracePeriod: '30 days',
  });
}
