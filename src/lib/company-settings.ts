// Company settings and utilities - Multi-tenant version
import { getNeonPool } from '@/lib/db/neon';

export interface CompanySettings {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  tax_id: string | null;
  registration_number: string | null;
  logo_url: string | null;
  website: string | null;
  currency: string;
  fiscal_year_start: string;
  settings: Record<string, any>;
}

/**
 * Fetch company settings by ID
 */
export async function getCompanySettings(companyId: string): Promise<CompanySettings | null> {
  try {
    const pool = getNeonPool();
    const result = await pool.query(
      `SELECT
        id,
        name,
        email,
        phone,
        address,
        city,
        country,
        tax_id,
        registration_number,
        logo_url,
        website,
        currency,
        fiscal_year_start,
        settings
       FROM companies
       WHERE id = $1
       LIMIT 1`,
      [companyId]
    );

    if (!result.rowCount) {
      return null;
    }

    return result.rows[0] as CompanySettings;
  } catch (error) {
    console.error('Error fetching company settings:', error);
    return null;
  }
}

/**
 * Update company settings
 */
export async function updateCompanySettings(
  companyId: string, 
  settings: Partial<CompanySettings>
): Promise<{ success: boolean; error?: string }> {
  try {
    const pool = getNeonPool();
    const allowedColumns: Array<keyof CompanySettings> = [
      'name',
      'email',
      'phone',
      'address',
      'city',
      'country',
      'tax_id',
      'registration_number',
      'logo_url',
      'website',
      'currency',
      'fiscal_year_start',
      'settings',
    ];

    const entries = Object.entries(settings).filter(([key, value]) => {
      return allowedColumns.includes(key as keyof CompanySettings) && value !== undefined;
    });

    if (entries.length === 0) {
      return { success: true };
    }

    const sets = entries.map(([key], idx) => `${key} = $${idx + 1}`);
    const values = entries.map(([, value]) => value);

    values.push(companyId);

    await pool.query(
      `UPDATE companies
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}`,
      values
    );
  } catch (error: any) {
    console.error('Error updating company settings:', error);
    return { success: false, error: error.message || 'Failed to update settings' };
  }

  return { success: true };
}

/**
 * Upload company logo
 */
export async function uploadCompanyLogo(
  companyId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  void companyId;
  void file;
  return {
    success: false,
    error: 'Logo upload is not configured. Use S3/Cloud storage and save the URL in companies.logo_url.',
  };
}

/**
 * Get enabled modules for a company
 */
export async function getCompanyModules(companyId: string): Promise<string[]> {
  try {
    const pool = getNeonPool();
    const result = await pool.query(
      `SELECT module_id
       FROM subscription_modules
       WHERE company_id = $1
         AND is_active = true`,
      [companyId]
    );

    return result.rows.map((row: { module_id: string }) => row.module_id);
  } catch (error) {
    console.error('Error fetching company modules:', error);
    return [];
  }
}

/**
 * Enable a module for a company
 */
export async function enableModule(
  companyId: string, 
  moduleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const pool = getNeonPool();
    await pool.query(
      `INSERT INTO subscription_modules (
         company_id, module_id, is_active, monthly_price, currency, added_at, updated_at
       ) VALUES ($1, $2, true, 0, 'USD', NOW(), NOW())
       ON CONFLICT (company_id, module_id, is_active)
       DO UPDATE SET
         is_active = true,
         removed_at = NULL,
         updated_at = NOW()`,
      [companyId, moduleId]
    );
  } catch (error: any) {
    console.error('Error enabling module:', error);
    return { success: false, error: error.message || 'Failed to enable module' };
  }

  return { success: true };
}

/**
 * Disable a module for a company
 */
export async function disableModule(
  companyId: string, 
  moduleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const pool = getNeonPool();
    await pool.query(
      `UPDATE subscription_modules
       SET is_active = false,
           removed_at = NOW(),
           updated_at = NOW()
       WHERE company_id = $1 AND module_id = $2`,
      [companyId, moduleId]
    );
  } catch (error: any) {
    console.error('Error disabling module:', error);
    return { success: false, error: error.message || 'Failed to disable module' };
  }

  return { success: true };
}

/**
 * Format company address for display
 */
export function formatCompanyAddress(company: Partial<CompanySettings>): string {
  const parts = [
    company.address,
    company.city,
    company.country
  ].filter(Boolean);
  
  return parts.join(', ');
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'UGX': 'UGX',
    'KES': 'KES',
    'TZS': 'TZS',
  };
  
  return symbols[currency] || currency;
}
