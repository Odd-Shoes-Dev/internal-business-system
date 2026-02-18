/**
 * Whop payment utilities for accessing plan IDs and generating checkout links
 */

import { WHOP_PLAN_IDS, WHOP_MODULE_IDS, getPlanId, getModulePlanId } from './whop-config';
import { Region } from './regional-pricing';

export const WHOP_COMPANY_ID = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID;
export const WHOP_CHECKOUT_BASE = 'https://whop.com/checkout/';

/**
 * Get the purchase URL for a subscription plan
 */
export function getSubscriptionPurchaseUrl(
  tier: 'starter' | 'professional' | 'enterprise',
  billingPeriod: 'monthly' | 'annual',
  region: Region
): string | undefined {
  const planId = getPlanId(tier, billingPeriod, region);
  if (!planId) return undefined;
  return `${WHOP_CHECKOUT_BASE}${planId}`;
}

/**
 * Get the purchase URL for a module add-on
 */
export function getModulePurchaseUrl(moduleId: string, region: Region): string | undefined {
  const planId = getModulePlanId(moduleId, region);
  if (!planId) return undefined;
  return `${WHOP_CHECKOUT_BASE}${planId}`;
}

/**
 * Check if a plan exceeds Whop's $2500 transaction limit
 * Used to determine if we should show contact form instead of checkout
 */
export function planExceedsWhopLimit(price: number): boolean {
  return price > 2500;
}

/**
 * Get all available tiers and periods
 */
export function getAvailablePlans() {
  return {
    tiers: ['starter', 'professional', 'enterprise'] as const,
    periods: ['monthly', 'annual'] as const,
  };
}

/**
 * Check if a plan exists for a given region
 */
export function planExists(tier: string, billingPeriod: string, region: Region): boolean {
  const planId = getPlanId(tier, billingPeriod, region);
  return !!planId;
}

/**
 * Get contact information for enterprise support
 */
export function getEnterpriseContactInfo() {
  return {
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@blueoox.com',
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_LINK || 'https://wa.me/256XXXXXXXXX',
    displayPhone: process.env.NEXT_PUBLIC_DISPLAY_PHONE || '+256-XXX-XXXX-XXX',
  };
}
