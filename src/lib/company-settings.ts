// Company settings and utilities - Multi-tenant version
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

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
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error) {
    console.error('Error fetching company settings:', error);
    return null;
  }

  return data;
}

/**
 * Update company settings
 */
export async function updateCompanySettings(
  companyId: string, 
  settings: Partial<CompanySettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // @ts-ignore - Type mismatch between CompanySettings and database schema
  const { error } = await supabase
    .from('companies')
    .update(settings)
    .eq('id', companyId);

  if (error) {
    console.error('Error updating company settings:', error);
    return { success: false, error: error.message };
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
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${companyId}-${Date.now()}.${fileExt}`;
    const filePath = `company-logos/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('assets')
      .getPublicUrl(filePath);

    // Update company record
    await updateCompanySettings(companyId, { logo_url: publicUrl });

    return { success: true, url: publicUrl };
  } catch (error) {
    console.error('Error uploading logo:', error);
    return { success: false, error: 'Failed to upload logo' };
  }
}

/**
 * Get enabled modules for a company
 */
export async function getCompanyModules(companyId: string): Promise<string[]> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const { data, error } = await supabase
    .from('subscription_modules')
    .select('module_id')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching company modules:', error);
    return [];
  }

  return data?.map(m => m.module_id) || [];
}

/**
 * Enable a module for a company
 */
export async function enableModule(
  companyId: string, 
  moduleId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // TODO: This should integrate with Stripe to add subscription item
  const { error } = await supabase
    .from('subscription_modules')
    .upsert({ 
      company_id: companyId, 
      module_id: moduleId, 
      is_active: true,
      monthly_price: 0, // This should come from AVAILABLE_MODULES in modules.ts
      currency: 'USD'
    });

  if (error) {
    console.error('Error enabling module:', error);
    return { success: false, error: error.message };
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
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // TODO: This should integrate with Stripe to cancel subscription item
  const { error } = await supabase
    .from('subscription_modules')
    .update({ 
      is_active: false,
      removed_at: new Date().toISOString()
    })
    .eq('company_id', companyId)
    .eq('module_id', moduleId);

  if (error) {
    console.error('Error disabling module:', error);
    return { success: false, error: error.message };
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
