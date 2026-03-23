import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Check if a given date falls within a closed or locked fiscal period
 * @param supabase - Supabase client
 * @param transactionDate - The date to check
 * @param companyId - The company to check periods for
 * @returns Object with isClosed boolean and error message if applicable
 */
export async function isPeriodClosed(
  supabase: SupabaseClient,
  transactionDate: string | Date,
  companyId: string
): Promise<{ isClosed: boolean; message?: string; period?: any }> {
  try {
    const date = typeof transactionDate === 'string' 
      ? new Date(transactionDate) 
      : transactionDate;

    // Query fiscal periods that contain this date and are closed/locked
    // Must filter by company_id so one company's locked periods don't affect another
    const { data: periods, error } = await supabase
      .from('fiscal_periods')
      .select('*')
      .eq('company_id', companyId)
      .lte('start_date', date.toISOString().split('T')[0])
      .gte('end_date', date.toISOString().split('T')[0])
      .in('status', ['closed', 'locked'])
      .order('level', { ascending: false }) // Check smallest period first (month before quarter before year)
      .limit(1);

    if (error) {
      console.error('Error checking period lock:', error);
      return { isClosed: false };
    }

    if (periods && periods.length > 0) {
      const period = periods[0];
      return {
        isClosed: true,
        message: `Cannot modify transaction: The ${period.level} period "${period.name}" (${period.start_date} to ${period.end_date}) is ${period.status}.`,
        period: period
      };
    }

    return { isClosed: false };
  } catch (error) {
    console.error('Error in isPeriodClosed:', error);
    return { isClosed: false };
  }
}

/**
 * Check if user has permission to override period locks (admin only)
 * @param supabase - Supabase client
 * @param companyId - The company to check the user's role in
 * @returns true if user is admin in this company
 */
export async function canOverridePeriodLock(
  supabase: SupabaseClient,
  companyId: string
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check company-specific role via user_companies (not the global user_profiles.role)
    const { data: membership } = await supabase
      .from('user_companies')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    return membership?.role === 'admin';
  } catch (error) {
    console.error('Error checking period lock override permission:', error);
    return false;
  }
}

/**
 * Validate transaction date against period locks
 * Use this in API routes before creating/updating transactions
 * @param supabase - Supabase client
 * @param transactionDate - The date to validate
 * @param companyId - The company whose fiscal periods to check
 * @param allowAdminOverride - Whether to allow admins to override (default: false)
 * @returns Error message if period is closed, null if allowed
 */
export async function validatePeriodLock(
  supabase: SupabaseClient,
  transactionDate: string | Date,
  companyId: string,
  allowAdminOverride: boolean = false
): Promise<string | null> {
  const lockCheck = await isPeriodClosed(supabase, transactionDate, companyId);
  
  if (!lockCheck.isClosed) {
    return null; // Period is open, allow transaction
  }

  // If admin override is allowed, check if user is admin in this company
  if (allowAdminOverride) {
    const isAdmin = await canOverridePeriodLock(supabase, companyId);
    if (isAdmin) {
      return null; // Admin can override
    }
  }

  return lockCheck.message || 'Cannot modify transaction in a closed period.';
}
