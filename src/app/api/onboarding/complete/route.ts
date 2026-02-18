import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

interface CreateCompanyRequest {
  name: string;
  tier: 'starter' | 'professional' | 'enterprise';
  region: 'AFRICA' | 'ASIA' | 'EU' | 'GB' | 'US' | 'DEFAULT';
  billingPeriod: 'monthly' | 'annual';
}

export async function POST(request: NextRequest) {
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
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
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

    // Create company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name,
        subscription_plan: `${tier}-${billingPeriod}`,
        subscription_status: 'active',
        region,
        currency: 'USD', // Default to USD, will be updated when user sets preferences
      })
      .select()
      .single();

    if (companyError) {
      console.error('Company creation error:', companyError);
      return NextResponse.json(
        { error: 'Failed to create company' },
        { status: 500 }
      );
    }

    // Link user to company
    const { error: linkError } = await supabase
      .from('user_companies')
      .insert({
        user_id: user.id,
        company_id: company.id,
        is_primary: true,
        role: 'owner',
      });

    if (linkError) {
      console.error('User company link error:', linkError);
      return NextResponse.json(
        { error: 'Failed to link user to company' },
        { status: 500 }
      );
    }

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
