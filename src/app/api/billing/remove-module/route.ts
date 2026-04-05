import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const stripe = await getStripe();

    const body = await request.json();
    const { module_id } = body;

    if (!module_id) {
      return NextResponse.json({ error: 'Module ID required' }, { status: 400 });
    }

    // Get user's company and check permissions
    const profile = await db.query<{ company_id: string; role: string }>(
      'SELECT company_id, role FROM user_profiles WHERE id = $1 LIMIT 1',
      [user.id]
    );
    const profileRow = profile.rows[0];

    if (!profileRow?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (profileRow.role !== 'owner' && profileRow.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get module subscription
    const moduleResult = await db.query(
      `SELECT *
       FROM subscription_modules
       WHERE company_id = $1
         AND module_id = $2
         AND is_active = TRUE
       LIMIT 1`,
      [profileRow.company_id, module_id]
    );
    const module = moduleResult.rows[0];

    if (!module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    if (module.is_trial_module) {
      return NextResponse.json({ error: 'Cannot remove trial modules' }, { status: 400 });
    }

    // Check if it's an included module or paid module
    const isIncludedModule = module.is_included === true;

    // Remove from Stripe subscription (only if it's a PAID module with Stripe item)
    if (!isIncludedModule && module.stripe_subscription_item_id) {
      await stripe.subscriptionItems.del(module.stripe_subscription_item_id, {
        proration_behavior: 'create_prorations',
      });
    }

    // Deactivate in database
    await db.query(
      `UPDATE subscription_modules
       SET is_active = FALSE,
           removed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [module.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Module removed successfully',
      wasIncluded: isIncludedModule,
    });
  } catch (error) {
    console.error('Error removing module:', error);
    return NextResponse.json(
      { error: 'Failed to remove module' },
      { status: 500 }
    );
  }
}

