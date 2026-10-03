import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';

interface CreateCompanyRequest {
  name: string;
  tier: 'starter' | 'professional' | 'enterprise';
  region: 'AFRICA' | 'ASIA' | 'EU' | 'GB' | 'US' | 'DEFAULT';
  billingPeriod: 'monthly' | 'annual';
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

    const body: CreateCompanyRequest = await request.json();
    const { name, tier, region, billingPeriod } = body;

    if (!name || !tier || !region || !billingPeriod) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user's primary company (created by auth trigger during signup)
    const userCompanies = await db.query<{ company_id: string }>(
      `SELECT company_id
       FROM user_companies
       WHERE user_id = $1
         AND is_primary = TRUE
       LIMIT 1`,
      [user.id]
    );
    const existingCompanyId = userCompanies.rows[0]?.company_id;

    let companyId: string;
    const currency = region === 'AFRICA' ? 'UGX' : region === 'GB' ? 'GBP' : region === 'EU' ? 'EUR' : 'USD';

    if (!existingCompanyId) {
      // If no company exists, create one (fallback). It starts as a trial: only a
      // verified payment (the payment webhook) may mark a company active.
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);
      const newCompany = await db.query<{ id: string }>(
        `INSERT INTO companies (
           name, subscription_plan, subscription_status, region, currency, trial_ends_at
         )
         VALUES ($1, $2, 'trial', $3, $4, $5)
         RETURNING id`,
        [name, `${tier}-trial`, region, currency, trialEndsAt.toISOString()]
      );

      companyId = newCompany.rows[0].id;

      // Link user to the new company.
      await db.query(
        `INSERT INTO user_companies (user_id, company_id, is_primary, role)
         VALUES ($1, $2, TRUE, 'owner')
         ON CONFLICT (user_id, company_id) DO UPDATE
         SET is_primary = TRUE,
             role = 'owner'`,
        [user.id, companyId]
      );
    } else {
      // Update the company's details only. The subscription status and plan are set by
      // the payment webhook after a verified payment - never from this client call.
      companyId = existingCompanyId;

      await db.query(
        `UPDATE companies
         SET name = $2,
             region = $3,
             currency = $4,
             updated_at = NOW()
         WHERE id = $1`,
        [companyId, name, region, currency]
      );
    }

    // Ensure user profile exists with company_id
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

    // Get the updated/created company
    const companyResult = await db.query('SELECT * FROM companies WHERE id = $1 LIMIT 1', [companyId]);
    const company = companyResult.rows[0] ?? null;

    return NextResponse.json({
      success: true,
      company,
    });
  } catch (error: any) {
    console.error('Onboarding API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
