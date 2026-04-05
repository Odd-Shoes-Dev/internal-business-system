import { NextRequest, NextResponse } from 'next/server';
import { sendTrialReminderEmail, formatCurrencyForEmail } from '@/lib/email/send';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    // Get user's company
    const profileResult = await db.query<{ company_id: string | null }>(
      'SELECT company_id FROM user_profiles WHERE id = $1 LIMIT 1',
      [user.id]
    );
    const profile = profileResult.rows[0];

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get company subscription
    const subscriptionResult = await db.query(
      `SELECT s.*, c.name AS company_name, c.email AS company_email
       FROM subscriptions s
       INNER JOIN companies c ON c.id = s.company_id
       WHERE s.company_id = $1
         AND s.status = 'trial'
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [profile.company_id]
    );
    const subscription = subscriptionResult.rows[0] as any;

    if (!subscription) {
      return NextResponse.json({ error: 'No active trial found' }, { status: 404 });
    }

    if (!subscription.company_email) {
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
      to: subscription.company_email,
      companyName: subscription.company_name,
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
