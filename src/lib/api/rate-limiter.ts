import { getDbProvider } from '@/lib/provider';

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Rate limiter using database storage backend
 * Implements sliding window rate limiting per API key
 */
export class ApiRateLimiter {
  private static instance: ApiRateLimiter;
  
  public static getInstance(): ApiRateLimiter {
    if (!ApiRateLimiter.instance) {
      ApiRateLimiter.instance = new ApiRateLimiter();
    }
    return ApiRateLimiter.instance;
  }

  /**
   * Check if request is allowed and update rate limit counters
   */
  async checkRateLimit(
    apiKey: string, 
    limit: number, 
    windowMs: number = 60000 // 1 minute default
  ): Promise<RateLimitResult> {
    try {
      const db = getDbProvider();
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean up old entries first
      await db.query('DELETE FROM rate_limit_requests WHERE timestamp < $1', [windowStart]);

      // Count requests in current window
      const countResult = await db.query(
        `SELECT COUNT(*)::int AS request_count
         FROM rate_limit_requests
         WHERE api_key = $1
           AND timestamp >= $2`,
        [apiKey, windowStart]
      );
      const currentCount = Number((countResult.rows[0] as any)?.request_count || 0);
      const remaining = Math.max(0, limit - currentCount);
      const resetTime = now + windowMs;

      // If limit exceeded, return rejection
      if (currentCount >= limit) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetTime,
          retryAfter: Math.ceil(windowMs / 1000)
        };
      }

      // Record this request
      try {
        await db.query(
          `INSERT INTO rate_limit_requests (
             api_key,
             timestamp,
             endpoint,
             created_at
           ) VALUES ($1, $2, 'api_generic', NOW())`,
          [apiKey, now]
        );
      } catch (insertError) {
        // If we can't record the request, allow it but log the error
        console.error('Failed to record rate limit request:', insertError);
      }

      return {
        allowed: true,
        limit,
        remaining: remaining - 1, // Subtract this request
        resetTime
      };

    } catch (error) {
      console.error('Rate limit check failed:', error);
      
      // On error, allow the request (fail open)
      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        resetTime: Date.now() + windowMs
      };
    }
  }

  /**
   * Get current rate limit status without incrementing counter
   */
  async getRateLimitStatus(
    apiKey: string, 
    limit: number, 
    windowMs: number = 60000
  ): Promise<Omit<RateLimitResult, 'allowed'>> {
    try {
      const db = getDbProvider();
      const now = Date.now();
      const windowStart = now - windowMs;

      const countResult = await db.query(
        `SELECT COUNT(*)::int AS request_count
         FROM rate_limit_requests
         WHERE api_key = $1
           AND timestamp >= $2`,
        [apiKey, windowStart]
      );

      const currentCount = Number((countResult.rows[0] as any)?.request_count || 0);
      const remaining = Math.max(0, limit - currentCount);
      const resetTime = now + windowMs;

      return {
        limit,
        remaining,
        resetTime
      };

    } catch (error) {
      return {
        limit,
        remaining: limit,
        resetTime: Date.now() + windowMs
      };
    }
  }
}

/**
 * Middleware function to apply rate limiting to API routes
 */
export async function withRateLimit(
  apiKey: string,
  rateLimit: number,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const rateLimiter = ApiRateLimiter.getInstance();
  return await rateLimiter.checkRateLimit(apiKey, rateLimit, windowMs);
}