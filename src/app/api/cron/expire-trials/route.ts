import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint should be protected and called by a cron job
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role key for server-side operations
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
    const todayStr = now.toISOString();

    // Get all subscriptions where trial has expired
    const { data: expiredTrials, error } = await supabase
      .from('subscriptions')
      .select('*, companies!inner(name, email)')
      .eq('status', 'trial')
      .lt('trial_end_date', todayStr);

    if (error) {
      console.error('Error fetching expired trials:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'expired',
            updated_at: todayStr,
          })
          .eq('id', subscription.id);

        if (updateError) {
          throw updateError;
        }

        // Update company subscription status
        await supabase
          .from('companies')
          .update({
            subscription_status: 'expired',
            updated_at: todayStr,
          })
          .eq('id', subscription.company_id);

        // Deactivate all trial modules
        await supabase
          .from('subscription_modules')
          .update({
            is_active: false,
            updated_at: todayStr,
          })
          .eq('subscription_id', subscription.id)
          .eq('is_trial_module', true);

        // Create activity log
        await supabase
          .from('activity_logs')
          .insert({
            company_id: subscription.company_id,
            user_id: null, // System action
            action: 'trial_expired',
            entity_type: 'subscription',
            entity_id: subscription.id,
            metadata: {
              plan_tier: subscription.plan_tier,
              trial_end_date: subscription.trial_end_date,
              expired_at: todayStr,
            },
          });

        processed.push(subscription.companies?.name || subscription.company_id);

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
