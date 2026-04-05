import { NextRequest, NextResponse } from 'next/server';
import type { Region } from '@/lib/regional-pricing';
import { getDbProvider } from '@/lib/provider';
import { hashPassword } from '@/lib/auth/password';
import { createSessionToken, persistSession } from '@/lib/auth/session';

// Map country to region for pricing
function getRegionFromCountry(country: string): Region {
  const countryLower = country.toLowerCase();
  
  // Africa
  if ([
    'uganda', 'kenya', 'tanzania', 'rwanda', 'burundi',
    'south africa', 'nigeria', 'ghana', 'ethiopia', 'egypt',
    'morocco', 'algeria', 'tunisia', 'libya', 'senegal',
    'cameron', 'ivory coast', 'zimbabwe', 'zambia', 'mozambique'
  ].some(c => countryLower.includes(c))) {
    return 'AFRICA';
  }
  
  // United Kingdom
  if ([
    'united kingdom', 'uk', 'england', 'scotland', 'wales',
    'northern ireland', 'britain', 'great britain'
  ].some(c => countryLower.includes(c))) {
    return 'GB';
  }
  
  // European Union
  if ([
    'germany', 'france', 'italy', 'spain', 'netherlands',
    'belgium', 'austria', 'switzerland', 'poland', 'sweden',
    'norway', 'denmark', 'finland', 'ireland', 'portugal',
    'greece', 'czech', 'hungary', 'romania', 'bulgaria'
  ].some(c => countryLower.includes(c))) {
    return 'EU';
  }
  
  // United States
  if ([
    'united states', 'usa', 'us', 'america'
  ].some(c => countryLower.includes(c))) {
    return 'US';
  }
  
  // Asia
  if ([
    'india', 'china', 'japan', 'south korea', 'singapore',
    'malaysia', 'thailand', 'vietnam', 'philippines', 'indonesia',
    'bangladesh', 'pakistan', 'sri lanka'
  ].some(c => countryLower.includes(c))) {
    return 'ASIA';
  }
  
  return 'DEFAULT';
}

export async function POST(request: NextRequest) {
  try {
    const db = getDbProvider();
    const body = await request.json();

    const {
      // Company details
      companyName,
      email,
      phone,
      address,
      city,
      country,
      currency,
      taxId,
      registrationNumber,
      website,
      
      // Admin user
      firstName,
      lastName,
      userEmail,
      password,
      
      // Modules
      modules = [],
    } = body;

    // Validation
    if (!companyName || !userEmail || !password || !firstName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(userEmail).trim().toLowerCase();
    const fullName = `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim();

    // 1. Create app user
    const existing = await db.query('SELECT id FROM app_users WHERE email = $1 LIMIT 1', [normalizedEmail]);
    if (existing.rowCount > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const createdUser = await db.query<{ id: string }>(
      `INSERT INTO app_users (email, full_name, password_hash, role, email_verified)
       VALUES ($1, $2, $3, 'admin', TRUE)
       RETURNING id`,
      [normalizedEmail, fullName || null, hashPassword(password)]
    );
    const userId = createdUser.rows[0].id;

    // Keep compat auth.users in sync for legacy DB triggers/functions.
    await db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
      [
        userId,
        normalizedEmail,
        JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          role: 'admin',
          company_name: companyName,
          country: country || 'Uganda',
        }),
      ]
    );

    // Detect region based on country
    const region = getRegionFromCountry(country || 'Uganda');
    const resolvedCurrency = currency || (region === 'AFRICA' ? 'UGX' : region === 'GB' ? 'GBP' : region === 'EU' ? 'EUR' : 'USD');

    // 2. Create company
    const company = await db.query<{ id: string; name: string }>(
      `INSERT INTO companies (
         name, subdomain, email, phone, address, city, country, region, currency,
         tax_id, registration_number, website, subscription_status, subscription_plan, trial_ends_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         $10, $11, $12, 'trial', 'professional', $13
       )
       RETURNING id, name`,
      [
        companyName,
        companyName.toLowerCase().replace(/[^a-z0-9]/g, ''),
        email || null,
        phone || null,
        address || null,
        city || null,
        country || null,
        region,
        resolvedCurrency,
        taxId || null,
        registrationNumber || null,
        website || null,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ]
    );
    const companyId = company.rows[0].id;

    // 3. Link user to company
    await db.query(
      `INSERT INTO user_companies (user_id, company_id, role, is_primary)
       VALUES ($1, $2, 'admin', TRUE)`,
      [userId, companyId]
    );

    await db.query(
      `INSERT INTO user_profiles (id, email, full_name, role, is_active, company_id)
       VALUES ($1, $2, $3, 'admin', TRUE, $4)
       ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           is_active = TRUE,
           company_id = EXCLUDED.company_id,
           updated_at = NOW()`,
      [userId, normalizedEmail, fullName || null, companyId]
    );

    // 4. Enable selected modules
    if (modules.length > 0) {
      // Get module pricing from modules.ts
      const { AVAILABLE_MODULES } = await import('@/lib/modules');
      
      const moduleRecords = modules.map((moduleId: string) => {
        const moduleInfo = AVAILABLE_MODULES[moduleId as keyof typeof AVAILABLE_MODULES];
        return {
          company_id: companyId,
          module_id: moduleId,
          is_active: true,
          monthly_price: moduleInfo?.monthlyFee || 0,
          currency: region === 'AFRICA' ? 'UGX' : region === 'GB' ? 'GBP' : region === 'EU' ? 'EUR' : 'USD',
          is_trial_module: true, // During trial period
        };
      });

      for (const record of moduleRecords) {
        await db.query(
          `INSERT INTO subscription_modules (
             company_id, module_id, is_active, monthly_price, currency, is_trial_module
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            record.company_id,
            record.module_id,
            record.is_active,
            record.monthly_price,
            record.currency,
            record.is_trial_module,
          ]
        );
      }
    }

    // 5. Create default chart of accounts (copy from template)
    // This is simplified - you'd want to copy a full default chart
    const defaultAccounts = [
      { code: '1000', name: 'Assets', type: 'asset', parent_id: null },
      { code: '2000', name: 'Liabilities', type: 'liability', parent_id: null },
      { code: '3000', name: 'Equity', type: 'equity', parent_id: null },
      { code: '4000', name: 'Revenue', type: 'revenue', parent_id: null },
      { code: '5000', name: 'Expenses', type: 'expense', parent_id: null },
    ];

    const accountsWithCompany = defaultAccounts.map(acc => ({
      ...acc,
      company_id: companyId,
    }));

    for (const acc of accountsWithCompany) {
      await db.query(
        `INSERT INTO chart_of_accounts (code, name, type, parent_id, company_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [acc.code, acc.name, acc.type, acc.parent_id, acc.company_id]
      );
    }

    // 6. Create default bank account
    await db.query(
      `INSERT INTO bank_accounts (company_id, name, account_type, currency, current_balance, is_active)
       VALUES ($1, 'Cash on Hand', 'cash', $2, 0, TRUE)`,
      [companyId, resolvedCurrency]
    );

    // Create session for immediate login after registration.
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : undefined;
    const token = createSessionToken();
    await persistSession(userId, token, ipAddress, request.headers.get('user-agent') ?? undefined);

    return NextResponse.json({
      success: true,
      message: 'Company registered successfully',
      company: {
        id: companyId,
        name: company.rows[0].name,
      }
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
