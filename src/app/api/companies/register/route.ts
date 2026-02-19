import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { Region } from '@/lib/regional-pricing';

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
    const supabase = await createClient();
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

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userEmail,
      password: password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: 'admin',
        }
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Use service role for remaining operations (bypasses RLS)
    const supabaseAdmin = createServiceClient();

    // Detect region based on country
    const region = getRegionFromCountry(country || 'Uganda');

    // 2. Create company
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        subdomain: companyName.toLowerCase().replace(/[^a-z0-9]/g, ''),
        email: email,
        phone: phone,
        address: address,
        city: city,
        country: country,
        region: region,
        currency: currency || 'UGX',
        tax_id: taxId || null,
        registration_number: registrationNumber || null,
        website: website || null,
        subscription_status: 'trial',
        subscription_plan: 'professional',
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select()
      .single();

    if (companyError) {
      console.error('Company creation error:', companyError);
      // Cleanup: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Failed to create company: ' + companyError.message },
        { status: 500 }
      );
    }

    // 3. Link user to company
    const { error: userCompanyError } = await supabaseAdmin
      .from('user_companies')
      .insert({
        user_id: authData.user.id,
        company_id: company.id,
        role: 'admin',
        is_primary: true,
      });

    if (userCompanyError) {
      console.error('User-company link error:', userCompanyError);
      return NextResponse.json(
        { error: 'Failed to link user to company' },
        { status: 500 }
      );
    }

    // 4. Enable selected modules
    if (modules.length > 0) {
      // Get module pricing from modules.ts
      const { AVAILABLE_MODULES } = await import('@/lib/modules');
      
      const moduleRecords = modules.map((moduleId: string) => {
        const moduleInfo = AVAILABLE_MODULES[moduleId as keyof typeof AVAILABLE_MODULES];
        return {
          company_id: company.id,
          module_id: moduleId,
          is_active: true,
          monthly_price: moduleInfo?.monthlyFee || 0,
          currency: region === 'AFRICA' ? 'UGX' : region === 'GB' ? 'GBP' : region === 'EU' ? 'EUR' : 'USD',
          is_trial_module: true, // During trial period
        };
      });

      await supabaseAdmin
        .from('subscription_modules')
        .insert(moduleRecords);
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
      company_id: company.id,
    }));

    await supabaseAdmin
      .from('chart_of_accounts')
      .insert(accountsWithCompany);

    // 6. Create default bank account
    await supabaseAdmin
      .from('bank_accounts')
      .insert({
        company_id: company.id,
        name: 'Cash on Hand',
        account_type: 'cash',
        currency: currency || 'UGX',
        current_balance: 0,
        is_active: true,
      });

    return NextResponse.json({
      success: true,
      message: 'Company registered successfully',
      company: {
        id: company.id,
        name: company.name,
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
