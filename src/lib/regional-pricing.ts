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
      monthly: 45000,
      annually: 38000,
      setupFee: 0,
      currency: 'UGX',
      symbol: 'UGX',
      region: 'AFRICA'
    },
    ASIA: {
      monthly: 12,
      annually: 10,
      setupFee: 0,
      currency: 'USD',
      symbol: '$',
      region: 'ASIA'
    },
    EU: {
      monthly: 25,
      annually: 22,
      setupFee: 0,
      currency: 'EUR',
      symbol: '€',
      region: 'EU'
    },
    GB: {
      monthly: 22,
      annually: 20,
      setupFee: 0,
      currency: 'GBP',
      symbol: '£',
      region: 'GB'
    },
    US: {
      monthly: 29,
      annually: 26,
      setupFee: 0,
      currency: 'USD',
      symbol: '$',
      region: 'US'
    },
    DEFAULT: {
      monthly: 19,
      annually: 17,
      setupFee: 0,
      currency: 'USD',
      symbol: '$',
      region: 'DEFAULT'
    }
  },
  professional: {
    AFRICA: {
      monthly: 150000,
      annually: 135000,
      setupFee: 150000,
      currency: 'UGX',
      symbol: 'UGX',
      region: 'AFRICA'
    },
    ASIA: {
      monthly: 39,
      annually: 35,
      setupFee: 39,
      currency: 'USD',
      symbol: '$',
      region: 'ASIA'
    },
    EU: {
      monthly: 89,
      annually: 80,
      setupFee: 89,
      currency: 'EUR',
      symbol: '€',
      region: 'EU'
    },
    GB: {
      monthly: 79,
      annually: 71,
      setupFee: 79,
      currency: 'GBP',
      symbol: '£',
      region: 'GB'
    },
    US: {
      monthly: 99,
      annually: 89,
      setupFee: 99,
      currency: 'USD',
      symbol: '$',
      region: 'US'
    },
    DEFAULT: {
      monthly: 69,
      annually: 62,
      setupFee: 69,
      currency: 'USD',
      symbol: '$',
      region: 'DEFAULT'
    }
  },
  enterprise: {
    AFRICA: {
      monthly: 500000,
      annually: 450000,
      setupFee: 750000,
      currency: 'UGX',
      symbol: 'UGX',
      region: 'AFRICA'
    },
    ASIA: {
      monthly: 149,
      annually: 134,
      setupFee: 249,
      currency: 'USD',
      symbol: '$',
      region: 'ASIA'
    },
    EU: {
      monthly: 269,
      annually: 242,
      setupFee: 449,
      currency: 'EUR',
      symbol: '€',
      region: 'EU'
    },
    GB: {
      monthly: 239,
      annually: 215,
      setupFee: 399,
      currency: 'GBP',
      symbol: '£',
      region: 'GB'
    },
    US: {
      monthly: 299,
      annually: 269,
      setupFee: 499,
      currency: 'USD',
      symbol: '$',
      region: 'US'
    },
    DEFAULT: {
      monthly: 199,
      annually: 179,
      setupFee: 299,
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
