import { getDbProvider } from '@/lib/provider';
import { NextRequest, NextResponse } from 'next/server';

interface StartTrialRequest {
  name: string;
  tier: 'starter' | 'professional' | 'enterprise';
  region: 'AFRICA' | 'ASIA' | 'EU' | 'GB' | 'US' | 'DEFAULT';
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
    const { name, tier, region } = body;

    if (!name || !tier || !region) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user's primary company (created by auth trigger during signup)
    const userCompaniesResult = await db.query<{ company_id: string }>(
      `SELECT company_id
       FROM user_companies
       WHERE user_id = $1
         AND is_primary = true
       LIMIT 1`,
      [user.id]
    );
    const userCompanies = userCompaniesResult.rows[0];

    let companyId: string;

    if (!userCompanies) {
      // Create new company for trial using admin client to bypass RLS
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      const currency = region === 'AFRICA' ? 'UGX' : region === 'GB' ? 'GBP' : region === 'EU' ? 'EUR' : 'USD';
      const subdomain =
        name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') +
        '-' +
        user.id.slice(0, 8);

      const companyResult = await db.query(
        `INSERT INTO companies (
           name,
           subdomain,
           email,
           subscription_plan,
           subscription_status,
           region,
           currency,
           trial_ends_at
         ) VALUES (
           $1, $2, $3, $4, 'trial', $5, $6, $7
         )
         RETURNING *`,
        [name, subdomain, user.email || null, `${tier}-trial`, region, currency, trialEndDate.toISOString()]
      );
      const newCompany = companyResult.rows[0] as any;

      companyId = newCompany.id;

      // Link user to company using admin client
      await db.query(
        `INSERT INTO user_companies (
           user_id,
           company_id,
           is_primary,
           role
         ) VALUES ($1, $2, true, 'owner')
         ON CONFLICT (user_id, company_id)
         DO UPDATE SET is_primary = EXCLUDED.is_primary, role = EXCLUDED.role`,
        [user.id, newCompany.id]
      );
    } else {
      // Update existing company with trial info
      companyId = userCompanies.company_id;
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      const currency = region === 'AFRICA' ? 'UGX' : region === 'GB' ? 'GBP' : region === 'EU' ? 'EUR' : 'USD';
      await db.query(
        `UPDATE companies
         SET name = $2,
             subscription_plan = $3,
             subscription_status = 'trial',
             region = $4,
             currency = $5,
             trial_ends_at = $6,
             updated_at = NOW()
         WHERE id = $1`,
        [companyId, name, `${tier}-trial`, region, currency, trialEndDate.toISOString()]
      );
    }

    // Ensure user profile exists using admin client
    await db.query(
      `INSERT INTO user_profiles (
         id,
         email,
         full_name,
         is_active,
         company_id
       ) VALUES (
         $1, $2, $3, true, $4
       )
       ON CONFLICT (id)
       DO UPDATE SET
         email = EXCLUDED.email,
         full_name = EXCLUDED.full_name,
         is_active = true,
         company_id = EXCLUDED.company_id,
         updated_at = NOW()`,
      [user.id, user.email || '', user.full_name || '', companyId]
    );

    // Get the updated/created company
    const companyResult = await db.query('SELECT * FROM companies WHERE id = $1 LIMIT 1', [companyId]);
    const company = companyResult.rows[0] || null;

    return NextResponse.json({
      success: true,
      company,
      message: '30-day free trial started!',
    });
  } catch (error: any) {
    console.error('Trial API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
