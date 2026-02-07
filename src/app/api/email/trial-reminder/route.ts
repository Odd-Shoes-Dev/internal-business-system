import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendTrialReminderEmail, formatCurrencyForEmail, formatDateForEmail } from '@/lib/email/send';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get company subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*, companies!inner(name, email)')
      .eq('company_id', profile.company_id)
      .eq('status', 'trial')
      .single();

    if (!subscription) {
      return NextResponse.json({ error: 'No active trial found' }, { status: 404 });
    }

    if (!subscription.companies?.email) {
      return NextResponse.json({ error: 'No email address on file' }, { status: 400 });
    }

    // Calculate days remaining
    const trialEnd = new Date(subscription.trial_end_date);
    const now = new Date();
    const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) {
      return NextResponse.json({ error: 'Trial has already ended' }, { status: 400 });
    }

    // Get pricing for plan
    const planName = subscription.plan_tier.charAt(0).toUpperCase() + subscription.plan_tier.slice(1);
    const monthlyPrice = formatCurrencyForEmail(
      subscription.base_price_amount * 100,
      subscription.currency
    );

    // Send reminder email
    const result = await sendTrialReminderEmail({
      to: subscription.companies.email,
      companyName: subscription.companies.name,
      daysRemaining,
      planName,
      monthlyPrice,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      emailId: result.id,
      daysRemaining,
    });
  } catch (error) {
    console.error('Error sending trial reminder:', error);
    return NextResponse.json(
      { error: 'Failed to send trial reminder' },
      { status: 500 }
    );
  }
}
