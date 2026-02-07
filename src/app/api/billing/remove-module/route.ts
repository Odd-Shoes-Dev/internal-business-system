import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const stripe = await getStripe();
    
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
    const body = await request.json();
    const { module_id } = body;

    if (!module_id) {
      return NextResponse.json({ error: 'Module ID required' }, { status: 400 });
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company and check permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (profile.role !== 'owner' && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get module subscription
    const { data: module } = await supabase
      .from('subscription_modules')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('module_id', module_id)
      .eq('is_active', true)
      .single();

    if (!module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    if (module.is_trial_module) {
      return NextResponse.json({ error: 'Cannot remove trial modules' }, { status: 400 });
    }

    // Remove from Stripe subscription
    if (module.stripe_subscription_item_id) {
      await stripe.subscriptionItems.del(module.stripe_subscription_item_id, {
        proration_behavior: 'create_prorations',
      });
    }

    // Deactivate in database
    await supabaseAdmin
      .from('subscription_modules')
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
      })
      .eq('id', module.id);

    return NextResponse.json({
      success: true,
      message: 'Module removed successfully',
    });
  } catch (error) {
    console.error('Error removing module:', error);
    return NextResponse.json(
      { error: 'Failed to remove module' },
      { status: 500 }
    );
  }
}
