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
      // If no company exists, create one (fallback).
      const newCompany = await db.query<{ id: string }>(
        `INSERT INTO companies (
           name, subscription_plan, subscription_status, region, currency
         )
         VALUES ($1, $2, 'active', $3, $4)
         RETURNING id`,
        [name, `${tier}-${billingPeriod}`, region, currency]
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
      // Update existing company with subscription info.
      companyId = existingCompanyId;

      await db.query(
        `UPDATE companies
         SET name = $2,
             subscription_plan = $3,
             subscription_status = 'active',
             region = $4,
             currency = $5,
             updated_at = NOW()
         WHERE id = $1`,
        [companyId, name, `${tier}-${billingPeriod}`, region, currency]
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
