import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint cleans up cancelled/expired subscriptions after grace period
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

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
    const { data: oldSubscriptions } = await supabase
      .from('subscriptions')
      .select('id, company_id, status, cancelled_at, companies!inner(name)')
      .in('status', ['cancelled', 'expired'])
      .or(`cancelled_at.lt.${cutoffStr},updated_at.lt.${cutoffStr}`)
      .eq('is_archived', false);

    if (oldSubscriptions && oldSubscriptions.length > 0) {
      for (const subscription of oldSubscriptions) {
        try {
          // Deactivate all modules
          const { error: moduleError } = await supabase
            .from('subscription_modules')
            .update({
              is_active: false,
              updated_at: now.toISOString(),
            })
            .eq('subscription_id', subscription.id);

          if (moduleError) {
            throw moduleError;
          }

          results.deactivatedModules += 1;

          // Mark subscription as archived
          await supabase
            .from('subscriptions')
            .update({
              is_archived: true,
              updated_at: now.toISOString(),
            })
            .eq('id', subscription.id);

          results.archivedSubscriptions += 1;

          // Log activity
          await supabase
            .from('activity_logs')
            .insert({
              company_id: subscription.company_id,
              user_id: null,
              action: 'subscription_archived',
              entity_type: 'subscription',
              entity_id: subscription.id,
              metadata: {
                status: subscription.status,
                archived_at: now.toISOString(),
                grace_period_days: gracePeriodDays,
              },
            });

        } catch (err: any) {
          console.error(`Error archiving subscription ${subscription.id}:`, err);
          results.errors.push({
            company: (subscription.companies as any)?.name,
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

    const { data: warningSubscriptions } = await supabase
      .from('subscriptions')
      .select('id, company_id, status, companies!inner(name, email)')
      .in('status', ['cancelled', 'expired'])
      .lt('cancelled_at', warnDateStr)
      .gt('cancelled_at', cutoffStr)
      .eq('is_archived', false);

    if (warningSubscriptions && warningSubscriptions.length > 0) {
      for (const subscription of warningSubscriptions) {
        // Check if we already sent a warning
        const { data: existingWarning } = await supabase
          .from('email_logs')
          .select('id')
          .eq('company_id', subscription.company_id)
          .eq('email_type', 'data_deletion_warning')
          .gte('sent_at', cutoffStr)
          .single();

        if (!existingWarning && (subscription.companies as any)?.email) {
          results.warned.push((subscription.companies as any)?.name || subscription.company_id);

          // TODO: Send warning email about upcoming data deletion
          // For now, just log the activity
          await supabase
            .from('activity_logs')
            .insert({
              company_id: subscription.company_id,
              user_id: null,
              action: 'grace_period_warning',
              entity_type: 'subscription',
              entity_id: subscription.id,
              metadata: {
                days_remaining: 3,
                deletion_date: cutoffDate.toISOString(),
              },
            });
        }
      }
    }

    // Step 3: Clean up old activity logs (optional - keep for 1 year)
    const activityCutoff = new Date(now);
    activityCutoff.setFullYear(activityCutoff.getFullYear() - 1);
    
    const { error: logCleanupError } = await supabase
      .from('activity_logs')
      .delete()
      .lt('created_at', activityCutoff.toISOString())
      .not('action', 'in', '("subscription_created","subscription_cancelled","payment_failed")'); // Keep important events

    if (logCleanupError) {
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
