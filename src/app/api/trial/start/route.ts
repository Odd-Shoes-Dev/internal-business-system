import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';

interface StartTrialRequest {
  tier: 'starter' | 'professional' | 'enterprise';
  region: 'AFRICA' | 'ASIA' | 'EU' | 'GB' | 'US' | 'DEFAULT';
  billingPeriod: 'monthly' | 'annual';
  /** Company name (from signup). Required when creating a new company; optional when updating. */
  name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const db = getDbProvider();
    const user = await db.getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: StartTrialRequest = await request.json();
    const { tier, region, billingPeriod, name: bodyName } = body;

    if (!tier || !region || !billingPeriod) {
      return NextResponse.json(
        { error: 'Missing required fields: tier, region, billingPeriod' },
        { status: 400 }
      );
    }

    // Get user's company created during signup trigger flow.
    const profileResult = await db.query(
      'SELECT company_id FROM user_profiles WHERE id = $1 LIMIT 1',
      [user.id]
    );
    const existingCompanyId = profileResult.rows[0]?.company_id as string | undefined;

    let companyId: string | undefined;
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);
    const currency = region === 'AFRICA' ? 'UGX' : region === 'GB' ? 'GBP' : region === 'EU' ? 'EUR' : 'USD';

    if (!existingCompanyId) {
      // No company yet (e.g. trigger didn't run or failed). Create one – name is REQUIRED (DB NOT NULL).
      const emailPrefix = user.email?.split('@')[0] || 'user';
      const companyName =
        bodyName?.trim() ||
        (user.full_name ? user.full_name + "'s Company" : emailPrefix + "'s Company");

      if (!companyName) {
        return NextResponse.json(
          { error: 'Company name is required to start a trial. Please provide "name" in the request body or complete signup with a company name.' },
          { status: 400 }
        );
      }

      const subdomain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '-' + (user.id as string).slice(0, 8);

      const createdCompany = await db.query(
        `INSERT INTO companies (
           name, subdomain, email, region, currency, subscription_plan, subscription_status, trial_ends_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'trial', $7)
         RETURNING id`,
        [companyName, subdomain, user.email ?? null, region, currency, `${tier}-trial`, trialEndDate.toISOString()]
      );

      companyId = createdCompany.rows[0]?.id;

      await db.query(
        `INSERT INTO user_companies (user_id, company_id, is_primary, role)
         VALUES ($1, $2, TRUE, 'admin')
         ON CONFLICT (user_id, company_id) DO UPDATE
         SET is_primary = EXCLUDED.is_primary,
             role = EXCLUDED.role`,
        [user.id, companyId]
      );

      await db.query(
        `INSERT INTO user_profiles (id, email, full_name, is_active, company_id)
         VALUES ($1, $2, $3, TRUE, $4)
         ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             full_name = EXCLUDED.full_name,
             is_active = TRUE,
             company_id = EXCLUDED.company_id,
             updated_at = NOW()`,
        [user.id, user.email || '', user.full_name || '', companyId]
      );
    } else {
      companyId = existingCompanyId;

      await db.query(
        `UPDATE companies
         SET subscription_plan = $2,
             subscription_status = 'trial',
             region = $3,
             currency = $4,
             trial_ends_at = $5,
             name = COALESCE($6, name),
             updated_at = NOW()
         WHERE id = $1`,
        [companyId, `${tier}-trial`, region, currency, trialEndDate.toISOString(), bodyName?.trim() || null]
      );
    }

    // Sync company_settings so dashboard and middleware see subscription_status and trial_end_date
    const existingSettings = await db.query(
      'SELECT id FROM company_settings WHERE company_id = $1 LIMIT 1',
      [companyId]
    );

    const trialStartDate = new Date();
    if (existingSettings.rowCount) {
      await db.query(
        `UPDATE company_settings
         SET subscription_status = 'trial',
             plan_tier = $2,
             billing_period = $3,
             trial_end_date = $4,
             updated_at = NOW()
         WHERE company_id = $1`,
        [companyId, tier, billingPeriod, trialEndDate.toISOString()]
      );
    } else {
      await db.query(
        `INSERT INTO company_settings (
           company_id, subscription_status, plan_tier, billing_period, trial_start_date, trial_end_date
         )
         VALUES ($1, 'trial', $2, $3, $4, $5)`,
        [companyId, tier, billingPeriod, trialStartDate.toISOString(), trialEndDate.toISOString()]
      );
    }

    // Get the updated company
    const companyResult = await db.query('SELECT * FROM companies WHERE id = $1 LIMIT 1', [companyId]);
    const company = companyResult.rows[0] ?? null;

    return NextResponse.json({
      success: true,
      company,
      message: '30-day free trial started successfully',
    });
  } catch (error: any) {
    console.error('Trial API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
