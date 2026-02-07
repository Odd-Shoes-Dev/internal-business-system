// Stripe Product and Price IDs Configuration
// This file maps plan tiers and modules to their Stripe product/price IDs

export const STRIPE_CONFIG = {
  // Base Plan Products
  products: {
    starter: 'prod_starter_blueox',
    professional: 'prod_professional_blueox',
    enterprise: 'prod_enterprise_blueox',
    
    // Module Products
    tours: 'prod_module_tours',
    fleet: 'prod_module_fleet',
    hotels: 'prod_module_hotels',
    cafe: 'prod_module_cafe',
    security: 'prod_module_security',
    inventory: 'prod_module_inventory',
  },
  
  // Price IDs for each plan tier and billing period
  // Format: {plan}_{period}_{currency}
  prices: {
    // Starter Plan Prices
    starter_monthly_usd: 'price_starter_monthly_usd',
    starter_annual_usd: 'price_starter_annual_usd',
    starter_monthly_eur: 'price_starter_monthly_eur',
    starter_annual_eur: 'price_starter_annual_eur',
    starter_monthly_gbp: 'price_starter_monthly_gbp',
    starter_annual_gbp: 'price_starter_annual_gbp',
    starter_monthly_ugx: 'price_starter_monthly_ugx',
    starter_annual_ugx: 'price_starter_annual_ugx',
    
    // Professional Plan Prices
    professional_monthly_usd: 'price_professional_monthly_usd',
    professional_annual_usd: 'price_professional_annual_usd',
    professional_monthly_eur: 'price_professional_monthly_eur',
    professional_annual_eur: 'price_professional_annual_eur',
    professional_monthly_gbp: 'price_professional_monthly_gbp',
    professional_annual_gbp: 'price_professional_annual_gbp',
    professional_monthly_ugx: 'price_professional_monthly_ugx',
    professional_annual_ugx: 'price_professional_annual_ugx',
    
    // Enterprise Plan Prices
    enterprise_monthly_usd: 'price_enterprise_monthly_usd',
    enterprise_annual_usd: 'price_enterprise_annual_usd',
    enterprise_monthly_eur: 'price_enterprise_monthly_eur',
    enterprise_annual_eur: 'price_enterprise_annual_eur',
    enterprise_monthly_gbp: 'price_enterprise_monthly_gbp',
    enterprise_annual_gbp: 'price_enterprise_annual_gbp',
    enterprise_monthly_ugx: 'price_enterprise_monthly_ugx',
    enterprise_annual_ugx: 'price_enterprise_annual_ugx',
    
    // Module Prices (monthly only, all currencies)
    module_tours_usd: 'price_module_tours_usd',
    module_tours_eur: 'price_module_tours_eur',
    module_tours_gbp: 'price_module_tours_gbp',
    module_tours_ugx: 'price_module_tours_ugx',
    
    module_fleet_usd: 'price_module_fleet_usd',
    module_fleet_eur: 'price_module_fleet_eur',
    module_fleet_gbp: 'price_module_fleet_gbp',
    module_fleet_ugx: 'price_module_fleet_ugx',
    
    module_hotels_usd: 'price_module_hotels_usd',
    module_hotels_eur: 'price_module_hotels_eur',
    module_hotels_gbp: 'price_module_hotels_gbp',
    module_hotels_ugx: 'price_module_hotels_ugx',
    
    module_cafe_usd: 'price_module_cafe_usd',
    module_cafe_eur: 'price_module_cafe_eur',
    module_cafe_gbp: 'price_module_cafe_gbp',
    module_cafe_ugx: 'price_module_cafe_ugx',
    
    module_security_usd: 'price_module_security_usd',
    module_security_eur: 'price_module_security_eur',
    module_security_gbp: 'price_module_security_gbp',
    module_security_ugx: 'price_module_security_ugx',
    
    module_inventory_usd: 'price_module_inventory_usd',
    module_inventory_eur: 'price_module_inventory_eur',
    module_inventory_gbp: 'price_module_inventory_gbp',
    module_inventory_ugx: 'price_module_inventory_ugx',
  },
};

// Helper to get price ID for a plan
export function getPlanPriceId(
  tier: 'starter' | 'professional' | 'enterprise',
  period: 'monthly' | 'annual',
  currency: 'USD' | 'EUR' | 'GBP' | 'UGX' = 'USD'
): string {
  const key = `${tier}_${period}_${currency.toLowerCase()}` as keyof typeof STRIPE_CONFIG.prices;
  return STRIPE_CONFIG.prices[key];
}

// Helper to get price ID for a module
export function getModulePriceId(
  moduleId: string,
  currency: 'USD' | 'EUR' | 'GBP' | 'UGX' = 'USD'
): string {
  const key = `module_${moduleId}_${currency.toLowerCase()}` as keyof typeof STRIPE_CONFIG.prices;
  return STRIPE_CONFIG.prices[key];
}

// Module pricing (for reference, actual prices from Stripe)
export const MODULE_PRICING = {
  tours: { usd: 39, eur: 35, gbp: 31, ugx: 145000 },
  fleet: { usd: 35, eur: 32, gbp: 28, ugx: 130000 },
  hotels: { usd: 45, eur: 41, gbp: 36, ugx: 167000 },
  cafe: { usd: 35, eur: 32, gbp: 28, ugx: 130000 },
  security: { usd: 29, eur: 26, gbp: 23, ugx: 108000 },
  inventory: { usd: 39, eur: 35, gbp: 31, ugx: 145000 },
};
