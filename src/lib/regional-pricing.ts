// Regional Pricing Configuration for BlueOx

export type Region = 'AFRICA' | 'ASIA' | 'EU' | 'GB' | 'US' | 'DEFAULT';
export type Currency = 'UGX' | 'USD' | 'EUR' | 'GBP';

export interface RegionalPrice {
  monthly: number;
  annually: number;
  setupFee: number;
  currency: Currency;
  symbol: string;
  region: Region;
}

export interface PricingTier {
  AFRICA: RegionalPrice;
  ASIA: RegionalPrice;
  EU: RegionalPrice;
  GB: RegionalPrice;
  US: RegionalPrice;
  DEFAULT: RegionalPrice;
}

// Pricing structure: Affordable for Africa/Asia, competitive for Europe/US
export const PRICING: Record<'starter' | 'professional' | 'enterprise', PricingTier> = {
  starter: {
    AFRICA: {
      monthly: 70000,
      annually: 60000,
      setupFee: 0,
      currency: 'UGX',
      symbol: 'UGX',
      region: 'AFRICA'
    },
    ASIA: {
      monthly: 19,
      annually: 17,
      setupFee: 0,
      currency: 'USD',
      symbol: '$',
      region: 'ASIA'
    },
    EU: {
      monthly: 35,
      annually: 32,
      setupFee: 0,
      currency: 'EUR',
      symbol: '€',
      region: 'EU'
    },
    GB: {
      monthly: 32,
      annually: 29,
      setupFee: 0,
      currency: 'GBP',
      symbol: '£',
      region: 'GB'
    },
    US: {
      monthly: 39,
      annually: 35,
      setupFee: 0,
      currency: 'USD',
      symbol: '$',
      region: 'US'
    },
    DEFAULT: {
      monthly: 29,
      annually: 26,
      setupFee: 0,
      currency: 'USD',
      symbol: '$',
      region: 'DEFAULT'
    }
  },
  professional: {
    AFRICA: {
      monthly: 250000,
      annually: 225000,
      setupFee: 0,
      currency: 'UGX',
      symbol: 'UGX',
      region: 'AFRICA'
    },
    ASIA: {
      monthly: 69,
      annually: 62,
      setupFee: 0,
      currency: 'USD',
      symbol: '$',
      region: 'ASIA'
    },
    EU: {
      monthly: 129,
      annually: 116,
      setupFee: 0,
      currency: 'EUR',
      symbol: '€',
      region: 'EU'
    },
    GB: {
      monthly: 119,
      annually: 107,
      setupFee: 0,
      currency: 'GBP',
      symbol: '£',
      region: 'GB'
    },
    US: {
      monthly: 149,
      annually: 134,
      setupFee: 0,
      currency: 'USD',
      symbol: '$',
      region: 'US'
    },
    DEFAULT: {
      monthly: 99,
      annually: 89,
      setupFee: 0,
      currency: 'USD',
      symbol: '$',
      region: 'DEFAULT'
    }
  },
  enterprise: {
    AFRICA: {
      monthly: 900000,
      annually: 810000,
      setupFee: 0,
      currency: 'UGX',
      symbol: 'UGX',
      region: 'AFRICA'
    },
    ASIA: {
      monthly: 249,
      annually: 224,
      setupFee: 0,
      currency: 'USD',
      symbol: '$',
      region: 'ASIA'
    },
    EU: {
      monthly: 449,
      annually: 404,
      setupFee: 0,
      currency: 'EUR',
      symbol: '€',
      region: 'EU'
    },
    GB: {
      monthly: 399,
      annually: 359,
      setupFee: 0,
      currency: 'GBP',
      symbol: '£',
      region: 'GB'
    },
    US: {
      monthly: 499,
      annually: 449,
      setupFee: 0,
      currency: 'USD',
      symbol: '$',
      region: 'US'
    },
    DEFAULT: {
      monthly: 349,
      annually: 314,
      setupFee: 0,
      currency: 'USD',
      symbol: '$',
      region: 'DEFAULT'
    }
  }
};

// Detect user's region based on timezone (client-side detection)
export function detectRegion(): Region {
  if (typeof window === 'undefined') return 'DEFAULT';
  
  // Check localStorage first for cached region
  try {
    const cachedRegion = localStorage.getItem('blueox_region') as Region | null;
    if (cachedRegion && ['AFRICA', 'ASIA', 'EU', 'GB', 'US', 'DEFAULT'].includes(cachedRegion)) {
      return cachedRegion;
    }
  } catch (error) {
    // localStorage might be disabled
  }
  
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let detectedRegion: Region = 'DEFAULT';
    
    // AFRICA - East Africa & Sub-Saharan countries
    if (
      timezone.includes('Africa/Kampala') ||      // Uganda
      timezone.includes('Africa/Nairobi') ||      // Kenya
      timezone.includes('Africa/Dar_es_Salaam') || // Tanzania
      timezone.includes('Africa/Kigali') ||       // Rwanda
      timezone.includes('Africa/Lagos') ||        // Nigeria
      timezone.includes('Africa/Accra') ||        // Ghana
      timezone.includes('Africa/Addis_Ababa') ||  // Ethiopia
      timezone.includes('Africa/Harare') ||       // Zimbabwe
      timezone.includes('Africa/Lusaka') ||       // Zambia
      timezone.includes('Africa/Maputo')          // Mozambique
    ) {
      detectedRegion = 'AFRICA';
    }
    // ASIA - South & Southeast Asia
    else if (
      timezone.includes('Asia/Kolkata') ||        // India
      timezone.includes('Asia/Manila') ||         // Philippines
      timezone.includes('Asia/Bangkok') ||        // Thailand
      timezone.includes('Asia/Ho_Chi_Minh') ||    // Vietnam
      timezone.includes('Asia/Jakarta') ||        // Indonesia
      timezone.includes('Asia/Dhaka') ||          // Bangladesh
      timezone.includes('Asia/Karachi') ||        // Pakistan
      timezone.includes('Asia/Colombo')           // Sri Lanka
    ) {
      detectedRegion = 'ASIA';
    }
    // UK
    else if (timezone.includes('Europe/London')) {
      detectedRegion = 'GB';
    }
    // EU - European countries
    else if (timezone.includes('Europe/')) {
      detectedRegion = 'EU';
    }
    // US - North America
    else if (timezone.includes('America/')) {
      detectedRegion = 'US';
    }
    
    // Cache the detected region
    try {
      localStorage.setItem('blueox_region', detectedRegion);
    } catch (error) {
      // Ignore if localStorage is disabled
    }
    
    return detectedRegion;
  } catch (error) {
    return 'DEFAULT';
  }
}

// Get pricing for a specific tier and region
export function getPrice(tier: 'starter' | 'professional' | 'enterprise', region?: Region): RegionalPrice {
  const detectedRegion = region || detectRegion();
  return PRICING[tier][detectedRegion];
}

// Format price with proper currency formatting
export function formatPrice(price: number, currency: Currency): string {
  if (currency === 'UGX') {
    return `UGX ${price.toLocaleString('en-UG')}`;
  }
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  
  return formatter.format(price);
}

// Get region name for display
export function getRegionName(region: Region): string {
  const names: Record<Region, string> = {
    AFRICA: 'Africa',
    ASIA: 'Asia',
    EU: 'Europe',
    GB: 'United Kingdom',
    US: 'United States',
    DEFAULT: 'International'
  };
  return names[region];
}

// Calculate annual total
export function getAnnualTotal(monthlyPrice: number): number {
  return monthlyPrice * 12;
}

// Map ISO country code (or country string) to Region
export function mapCountryToRegion(countryCodeOrName?: string): Region {
  if (!countryCodeOrName) return 'DEFAULT';
  const code = countryCodeOrName.toUpperCase();

  const african = ['UG', 'KE', 'TZ', 'RW', 'BI', 'ZA', 'NG', 'GH', 'ET', 'EG', 'MA', 'DZ', 'TN', 'MW', 'ZM', 'ZW', 'MZ', 'SN', 'CM', 'CI'];
  const asian = ['IN', 'PH', 'TH', 'VN', 'ID', 'BD', 'PK', 'LK', 'MY', 'SG', 'JP', 'CN', 'KR'];
  const eu = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'IE', 'PT', 'GR', 'CZ', 'HU', 'RO', 'BG'];

  if (african.includes(code)) return 'AFRICA';
  if (asian.includes(code)) return 'ASIA';
  if (code === 'GB' || code === 'UK') return 'GB';
  if (eu.includes(code)) return 'EU';
  if (code === 'US' || code === 'CA' || code === 'MX') return 'US';

  // Fallback: check by name substrings
  const name = countryCodeOrName.toLowerCase();
  if (name.includes('uganda') || name.includes('kenya') || name.includes('tanzania')) return 'AFRICA';
  if (name.includes('india') || name.includes('philippines') || name.includes('thailand')) return 'ASIA';
  if (name.includes('germany') || name.includes('france') || name.includes('italy')) return 'EU';
  if (name.includes('united states') || name.includes('usa') || name.includes('america')) return 'US';

  return 'DEFAULT';
}

// Module pricing per region
export const MODULE_PRICING = {
  AFRICA: {
    tours: 75000,
    fleet: 65000,
    hotels: 85000,
    cafe: 65000,
    security: 55000,
    inventory: 75000,
    payroll: 95000,
    currencySymbol: 'UGX',
  },
  ASIA: {
    tours: 19,
    fleet: 17,
    hotels: 22,
    cafe: 17,
    security: 14,
    inventory: 19,
    payroll: 25,
    currencySymbol: '$',
  },
  EU: {
    tours: 39,
    fleet: 35,
    hotels: 45,
    cafe: 35,
    security: 29,
    inventory: 39,
    payroll: 49,
    currencySymbol: '€',
  },
  GB: {
    tours: 35,
    fleet: 31,
    hotels: 40,
    cafe: 31,
    security: 26,
    inventory: 35,
    payroll: 45,
    currencySymbol: '£',
  },
  US: {
    tours: 39,
    fleet: 35,
    hotels: 45,
    cafe: 35,
    security: 29,
    inventory: 39,
    payroll: 49,
    currencySymbol: '$',
  },
  DEFAULT: {
    tours: 39,
    fleet: 35,
    hotels: 45,
    cafe: 35,
    security: 29,
    inventory: 39,
    payroll: 49,
    currencySymbol: '$',
  },
};

// Helper object for easier access (compatible with old code)
export const regionalPricing = {
  AFRICA: {
    starter: { monthly: { min: 60, max: 70 }, annual: 60000, currencySymbol: 'UGX' },
    professional: { monthly: { min: 200, max: 250 }, annual: 2700000, currencySymbol: 'UGX' },
    enterprise: { monthly: { min: 800, max: 900 }, annual: 9720000, currencySymbol: 'UGX' },
    modules: MODULE_PRICING.AFRICA,
  },
  ASIA: {
    starter: { monthly: { min: 29, max: 39 }, annual: 408, currencySymbol: '$' },
    professional: { monthly: { min: 99, max: 149 }, annual: 1608, currencySymbol: '$' },
    enterprise: { monthly: { min: 349, max: 499 }, annual: 5388, currencySymbol: '$' },
    modules: MODULE_PRICING.ASIA,
  },
  EU: {
    starter: { monthly: { min: 29, max: 35 }, annual: 384, currencySymbol: '€' },
    professional: { monthly: { min: 89, max: 129 }, annual: 1392, currencySymbol: '€' },
    enterprise: { monthly: { min: 349, max: 449 }, annual: 4848, currencySymbol: '€' },
    modules: MODULE_PRICING.EU,
  },
  GB: {
    starter: { monthly: { min: 26, max: 32 }, annual: 348, currencySymbol: '£' },
    professional: { monthly: { min: 79, max: 119 }, annual: 1284, currencySymbol: '£' },
    enterprise: { monthly: { min: 299, max: 399 }, annual: 4308, currencySymbol: '£' },
    modules: MODULE_PRICING.GB,
  },
  US: {
    starter: { monthly: { min: 29, max: 39 }, annual: 408, currencySymbol: '$' },
    professional: { monthly: { min: 99, max: 149 }, annual: 1608, currencySymbol: '$' },
    enterprise: { monthly: { min: 349, max: 499 }, annual: 5388, currencySymbol: '$' },
    modules: MODULE_PRICING.US,
  },
  DEFAULT: {
    starter: { monthly: { min: 29, max: 39 }, annual: 408, currencySymbol: '$' },
    professional: { monthly: { min: 99, max: 149 }, annual: 1608, currencySymbol: '$' },
    enterprise: { monthly: { min: 349, max: 499 }, annual: 5388, currencySymbol: '$' },
    modules: MODULE_PRICING.DEFAULT,
  },
};
