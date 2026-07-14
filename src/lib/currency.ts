// Currency utilities for multi-currency support
// Handles formatting, conversion, and exchange rate fetching

export type SupportedCurrency = string;

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Keep for backwards-compat — used by CurrencySelect and other UI pickers
export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$',   name: 'US Dollar',          decimals: 2 },
  EUR: { code: 'EUR', symbol: '€',   name: 'Euro',               decimals: 2 },
  GBP: { code: 'GBP', symbol: '£',   name: 'British Pound',      decimals: 2 },
  UGX: { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling',   decimals: 0 },
  KES: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling',    decimals: 2 },
  TZS: { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', decimals: 0 },
  RWF: { code: 'RWF', symbol: 'Fr',  name: 'Rwandan Franc',      decimals: 0 },
  NGN: { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira',     decimals: 2 },
  GHS: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi',      decimals: 2 },
  ZAR: { code: 'ZAR', symbol: 'R',   name: 'South African Rand', decimals: 2 },
  ETB: { code: 'ETB', symbol: 'Br',  name: 'Ethiopian Birr',     decimals: 2 },
  INR: { code: 'INR', symbol: '₹',   name: 'Indian Rupee',       decimals: 2 },
  CNY: { code: 'CNY', symbol: '¥',   name: 'Chinese Yuan',       decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥',   name: 'Japanese Yen',       decimals: 0 },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham',         decimals: 2 },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar',    decimals: 2 },
  AUD: { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar',  decimals: 2 },
  CHF: { code: 'CHF', symbol: 'Fr',  name: 'Swiss Franc',        decimals: 2 },
  SEK: { code: 'SEK', symbol: 'kr',  name: 'Swedish Krona',      decimals: 2 },
  NOK: { code: 'NOK', symbol: 'kr',  name: 'Norwegian Krone',    decimals: 2 },
  DKK: { code: 'DKK', symbol: 'kr',  name: 'Danish Krone',       decimals: 2 },
};

export const DEFAULT_CURRENCY = 'USD';

/**
 * Format amount as currency string.
 * Uses the known symbol table first; falls back to Intl for any other ISO code.
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = DEFAULT_CURRENCY
): string {
  const code = (currencyCode || DEFAULT_CURRENCY).toUpperCase();
  const known = SUPPORTED_CURRENCIES[code];

  if (known) {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: known.decimals,
      maximumFractionDigits: known.decimals,
    }).format(amount);
    return `${known.symbol} ${formatted}`;
  }

  // Fallback: let Intl resolve the symbol for any other ISO 4217 code
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
    }).format(amount);
  } catch {
    // Truly unknown code — show code as prefix
    return `${code} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
  }
}

/**
 * Get currency symbol — uses known table, falls back to Intl
 */
export function getCurrencySymbol(currencyCode: string): string {
  const code = (currencyCode || DEFAULT_CURRENCY).toUpperCase();
  if (SUPPORTED_CURRENCIES[code]) return SUPPORTED_CURRENCIES[code].symbol;
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'symbol' })
      .formatToParts(0);
    return parts.find(p => p.type === 'currency')?.value || code;
  } catch {
    return code;
  }
}

/**
 * Get currency info — falls back gracefully for any ISO code
 */
export function getCurrencyInfo(currencyCode: string): CurrencyInfo {
  const code = (currencyCode || DEFAULT_CURRENCY).toUpperCase();
  if (SUPPORTED_CURRENCIES[code]) return SUPPORTED_CURRENCIES[code];
  return { code, symbol: getCurrencySymbol(code), name: code, decimals: 2 };
}

/**
 * Fetch latest exchange rates from API
 */
export async function fetchExchangeRates(baseCurrency: SupportedCurrency = 'USD'): Promise<Record<string, number> | null> {
  try {
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
    
    if (!response.ok) {
      console.error('Failed to fetch exchange rates:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.rates || null;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return null;
  }
}

/**
 * Update exchange rates in database
 */
export async function updateExchangeRates(dbClient: any): Promise<boolean> {
  try {
    // Fetch rates for USD base (most common)
    const rates = await fetchExchangeRates('USD');
    
    if (!rates) {
      return false;
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Prepare exchange rate records
    const exchangeRates = [];
    
    for (const currency of Object.keys(SUPPORTED_CURRENCIES)) {
      if (currency === 'USD') continue;
      
      if (rates[currency]) {
        // USD to other currency
        exchangeRates.push({
          from_currency: 'USD',
          to_currency: currency,
          rate: rates[currency],
          effective_date: today,
          source: 'exchangerate-api.com',
        });
        
        // Other currency to USD
        exchangeRates.push({
          from_currency: currency,
          to_currency: 'USD',
          rate: 1 / rates[currency],
          effective_date: today,
          source: 'exchangerate-api.com',
        });
      }
    }

    // Insert/update exchange rates
    const { error } = await dbClient
      .from('exchange_rates')
      .upsert(exchangeRates, {
        onConflict: 'from_currency,to_currency,effective_date',
      });

    if (error) {
      console.error('Failed to save exchange rates:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating exchange rates:', error);
    return false;
  }
}

/**
 * Format amount with conversion info
 * Example: "USh 3,700,000 (≈ $1,000)"
 */
export function formatCurrencyWithConversion(
  amount: number,
  currency: SupportedCurrency,
  convertedAmount?: number | null,
  baseCurrency: SupportedCurrency = 'USD'
): string {
  const mainFormatted = formatCurrency(amount, currency);
  
  if (currency === baseCurrency || !convertedAmount) {
    return mainFormatted;
  }

  const convertedFormatted = formatCurrency(convertedAmount, baseCurrency);
  return `${mainFormatted} (≈ ${convertedFormatted})`;
}
