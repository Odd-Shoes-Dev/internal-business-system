import { NextRequest, NextResponse } from 'next/server';
import {
  getCompanyIdFromRequest,
  requireCompanyAccess,
  requireSessionUser,
} from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const memberships = await db.query(
      `SELECT uc.company_id,
              uc.is_primary,
              uc.role,
              c.*
       FROM user_companies uc
       INNER JOIN companies c ON c.id = uc.company_id
       WHERE uc.user_id = $1
       ORDER BY uc.is_primary DESC, uc.joined_at ASC`,
      [user.id]
    );

    const companies = memberships.rows.map((row: any) => ({
      id: row.company_id,
      name: row.name,
      subdomain: row.subdomain,
      email: row.email,
      phone: row.phone,
      address: row.address,
      city: row.city || null,
      country: row.country || null,
      website: row.website || null,
      logo_url: row.logo_url,
      currency: row.currency || 'USD',
      subscription_status: row.subscription_status || 'trial',
      subscription_plan: row.subscription_plan || 'professional',
      tax_id: row.tax_id,
      registration_number: row.registration_number,
      fiscal_year_start: row.fiscal_year_start || null,
      fiscal_year_start_month: row.fiscal_year_start_month || null,
      default_payment_terms: row.default_payment_terms || null,
      sales_tax_rate: row.sales_tax_rate || null,
      trial_ends_at: row.trial_ends_at,
      region: row.region || 'DEFAULT',
      role: row.role,
      is_primary: row.is_primary,
    }));

    let selectedCompanyId = getCompanyIdFromRequest(request);
    if (!selectedCompanyId) {
      selectedCompanyId = companies.find((c) => c.is_primary)?.id || companies[0]?.id || null;
    }

    let modules: string[] = [];
    if (selectedCompanyId) {
      const moduleRows = await db.query<{ module_id: string }>(
        'SELECT module_id FROM subscription_modules WHERE company_id = $1 AND is_active = TRUE',
        [selectedCompanyId]
      );
      modules = moduleRows.rows.map((m) => m.module_id);
    }

    return NextResponse.json({
      user,
      companies,
      currentCompanyId: selectedCompanyId,
      modules,
    });
  } catch (error: any) {
    console.error('Failed to load user companies:', error);
    return NextResponse.json({ error: 'Failed to load user companies' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const companyId = getCompanyIdFromRequest(request, body);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const {
      name,
      email,
      phone,
      address,
      city,
      country,
      tax_id,
      registration_number,
      website,
      logo_url,
      fiscal_year_start,
      default_payment_terms,
      sales_tax_rate,
    } = body;

    const updateResult = await db.query(
      `UPDATE companies
       SET name = COALESCE($2, name),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           address = COALESCE($5, address),
           city = COALESCE($6, city),
           country = COALESCE($7, country),
           tax_id = COALESCE($8, tax_id),
           registration_number = COALESCE($9, registration_number),
           website = COALESCE($10, website),
           logo_url = COALESCE($11, logo_url),
           fiscal_year_start = COALESCE($12::text, fiscal_year_start),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        companyId,
        name || null,
        email || null,
        phone || null,
        address || null,
        city || null,
        country || null,
        tax_id || null,
        registration_number || null,
        website || null,
        logo_url || null,
        fiscal_year_start || null,
      ]
    );

    // Also update default_payment_terms and sales_tax_rate in company_settings if provided
    if (typeof default_payment_terms === 'number' || typeof sales_tax_rate === 'number') {
      await db.query(
        `UPDATE company_settings
         SET default_payment_terms = COALESCE($2, default_payment_terms),
             sales_tax_rate = COALESCE($3, sales_tax_rate),
             updated_at = NOW()
         WHERE company_id = $1`,
        [
          companyId,
          typeof default_payment_terms === 'number' ? default_payment_terms : null,
          typeof sales_tax_rate === 'number' ? sales_tax_rate : null,
        ]
      );
    }

    return NextResponse.json({ data: updateResult.rows[0] });
  } catch (error: any) {
    console.error('Failed to update company:', error);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
}
