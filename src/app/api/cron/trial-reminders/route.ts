import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTrialReminderEmail, formatCurrencyForEmail } from '@/lib/email/send';

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

    // Get all trial subscriptions
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*, companies!inner(name, email)')
      .eq('status', 'trial')
      .not('trial_end_date', 'is', null);

    if (error) {
      console.error('Error fetching trial subscriptions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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

        if (!subscription.companies?.email) {
          console.log(`No email for company: ${subscription.company_id}`);
          continue;
        }

        // Check if we already sent a reminder today
        const today = now.toISOString().split('T')[0];
        const { data: existingLog } = await supabase
          .from('email_logs')
          .select('id')
          .eq('company_id', subscription.company_id)
          .eq('email_type', 'trial_reminder')
          .gte('sent_at', today)
          .single();

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
          to: subscription.companies.email,
          companyName: subscription.companies.name,
          daysRemaining,
          planName,
          monthlyPrice,
        });

        if (result.success) {
          emailsSent.push(subscription.companies.email);

          // Log the email
          await supabase.from('email_logs').insert({
            company_id: subscription.company_id,
            email_type: 'trial_reminder',
            recipient: subscription.companies.email,
            subject: `Your BlueOx trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
            sent_at: now.toISOString(),
            external_id: result.id,
            status: 'sent',
          });
        } else {
          errors.push({
            company: subscription.companies.name,
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
