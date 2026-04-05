import { getDbProvider } from '@/lib/provider';

export interface SubscriptionValidation {
  isValid: boolean;
  planTier: string | null;
  hasApiAccess: boolean;
  rateLimit: number;
  error?: string;
}

/**
 * Validates if a company has API access based on their subscription
 */
export async function validateApiAccess(companyId: string): Promise<SubscriptionValidation> {
  try {
    const db = getDbProvider();
    
    // Get subscription details
    const subscriptionResult = await db.query(
      `SELECT plan_tier, status, current_period_end
       FROM subscriptions
       WHERE company_id = $1
         AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [companyId]
    );
    const subscription = subscriptionResult.rows[0] as any;

    if (!subscription) {
      return {
        isValid: false,
        planTier: null,
        hasApiAccess: false,
        rateLimit: 0,
        error: 'No active subscription found'
      };
    }

    // Check if subscription is still valid (not expired)
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    
    if (now > periodEnd) {
      return {
        isValid: false,
        planTier: subscription.plan_tier,
        hasApiAccess: false,
        rateLimit: 0,
        error: 'Subscription has expired'
      };
    }

    // Define API access and rate limits by plan
    const planConfig = {
      starter: {
        hasApiAccess: false,
        rateLimit: 0
      },
      professional: {
        hasApiAccess: true,
        rateLimit: 500
      },
      enterprise: {
        hasApiAccess: true,
        rateLimit: 2000
      }
    };

    const config = planConfig[subscription.plan_tier as keyof typeof planConfig];
    
    if (!config) {
      return {
        isValid: false,
        planTier: subscription.plan_tier,
        hasApiAccess: false,
        rateLimit: 0,
        error: 'Invalid subscription plan'
      };
    }

    return {
      isValid: true,
      planTier: subscription.plan_tier,
      hasApiAccess: config.hasApiAccess,
      rateLimit: config.rateLimit
    };

  } catch (error) {
    return {
      isValid: false,
      planTier: null,
      hasApiAccess: false,
      rateLimit: 0,
      error: 'Failed to validate subscription'
    };
  }
}

/**
 * Validates API access for integration routes
 */
export async function validateIntegrationAccess(apiKey: string): Promise<SubscriptionValidation & { integrationId?: string }> {
  try {
    const db = getDbProvider();
    
    // Get integration and company details
    const integrationResult = await db.query(
      `SELECT id, company_id, is_active, rate_limit_per_minute
       FROM api_integrations
       WHERE api_key = $1
         AND is_active = true
       LIMIT 1`,
      [apiKey]
    );
    const integration = integrationResult.rows[0] as any;

    if (!integration) {
      return {
        isValid: false,
        planTier: null,
        hasApiAccess: false,
        rateLimit: 0,
        error: 'Invalid API key'
      };
    }

    // Validate company subscription
    const subscriptionValidation = await validateApiAccess(integration.company_id);
    
    if (!subscriptionValidation.hasApiAccess) {
      return {
        ...subscriptionValidation,
        integrationId: integration.id
      };
    }

    // Use the lower of subscription limit or integration-specific limit
    const effectiveRateLimit = Math.min(
      subscriptionValidation.rateLimit,
      integration.rate_limit_per_minute || 100
    );

    return {
      isValid: true,
      planTier: subscriptionValidation.planTier,
      hasApiAccess: true,
      rateLimit: effectiveRateLimit,
      integrationId: integration.id
    };

  } catch (error) {
    return {
      isValid: false,
      planTier: null,
      hasApiAccess: false,
      rateLimit: 0,
      error: 'Failed to validate integration access'
    };
  }
}