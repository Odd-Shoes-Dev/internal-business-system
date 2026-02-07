import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
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

    // Verify user is admin (you can implement proper role checking)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get subscription stats
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('status, base_price_amount, currency');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stats = {
      totalSubscriptions: subscriptions?.length || 0,
      activeSubscriptions: subscriptions?.filter((s) => s.status === 'active').length || 0,
      trialSubscriptions: subscriptions?.filter((s) => s.status === 'trial').length || 0,
      expiredSubscriptions: subscriptions?.filter((s) => s.status === 'expired').length || 0,
      pastDueSubscriptions: subscriptions?.filter((s) => s.status === 'past_due').length || 0,
      cancelledSubscriptions: subscriptions?.filter((s) => s.status === 'cancelled').length || 0,
      totalRevenue: 0,
      monthlyRecurringRevenue: 0,
    };

    // Calculate MRR (convert to cents)
    stats.monthlyRecurringRevenue = subscriptions
      ?.filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + (s.base_price_amount * 100), 0) || 0;

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching subscription stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription stats' },
      { status: 500 }
    );
  }
}
