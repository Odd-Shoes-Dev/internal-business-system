import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ApiHealthCheck {
  endpoint: string;
  status: 'healthy' | 'degraded' | 'down';
  response_time: number;
  last_checked: string;
  error_message?: string;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  timestamp: string;
  database: ApiHealthCheck;
  endpoints: ApiHealthCheck[];
  rate_limiting: ApiHealthCheck;
  overall_performance: {
    avg_response_time: number;
    error_rate: number;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    const health: SystemHealth = {
      status: 'healthy',
      version: process.env.npm_package_version || '2.0.0',
      timestamp: new Date().toISOString(),
      database: await checkDatabaseHealth(),
      endpoints: await checkCriticalEndpoints(),
      rate_limiting: await checkRateLimitingHealth(),
      overall_performance: await getPerformanceMetrics()
    };

    // Determine overall health status
    const allChecks = [health.database, ...health.endpoints, health.rate_limiting];
    const downCount = allChecks.filter(check => check.status === 'down').length;
    const degradedCount = allChecks.filter(check => check.status === 'degraded').length;

    if (downCount > 0) {
      health.status = 'down';
    } else if (degradedCount > 0) {
      health.status = 'degraded';
    }

    const responseTime = Date.now() - startTime;
    
    // Add response time header
    const headers = {
      'X-Response-Time': `${responseTime}ms`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Type': 'application/json'
    };

    const status = health.status === 'down' ? 503 : 
                   health.status === 'degraded' ? 200 : 200;

    return NextResponse.json(health, { status, headers });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json(
      {
        status: 'down',
        version: process.env.npm_package_version || '2.0.0',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        response_time: responseTime
      },
      { 
        status: 503,
        headers: {
          'X-Response-Time': `${responseTime}ms`
        }
      }
    );
  }
}

async function checkDatabaseHealth(): Promise<ApiHealthCheck> {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    // Simple query to test database connectivity
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        endpoint: 'database',
        status: 'down',
        response_time: responseTime,
        last_checked: new Date().toISOString(),
        error_message: error.message
      };
    }

    return {
      endpoint: 'database',
      status: responseTime > 1000 ? 'degraded' : 'healthy',
      response_time: responseTime,
      last_checked: new Date().toISOString()
    };

  } catch (error) {
    return {
      endpoint: 'database',
      status: 'down',
      response_time: Date.now() - startTime,
      last_checked: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkCriticalEndpoints(): Promise<ApiHealthCheck[]> {
  const endpoints = [
    '/api/integrations/salon/webhook',
    '/api/integrations/reports/financial-summary',
    '/api/integrations/api-keys'
  ];

  const checks = await Promise.all(
    endpoints.map(async (endpoint) => {
      const startTime = Date.now();
      
      try {
        // For internal checks, we can simulate the request
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${endpoint}`, {
          method: 'OPTIONS', // Use OPTIONS to avoid side effects
          headers: {
            'User-Agent': 'HealthCheck/1.0'
          }
        });

        const responseTime = Date.now() - startTime;
        const status: 'healthy' | 'degraded' | 'down' = response.ok ? 'healthy' : 
                      response.status >= 500 ? 'down' : 'degraded';

        return {
          endpoint,
          status,
          response_time: responseTime,
          last_checked: new Date().toISOString()
        } as ApiHealthCheck;

      } catch (error) {
        return {
          endpoint,
          status: 'down' as const,
          response_time: Date.now() - startTime,
          last_checked: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Connection failed'
        } as ApiHealthCheck;
      }
    })
  );

  return checks;
}

async function checkRateLimitingHealth(): Promise<ApiHealthCheck> {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    // Check if rate limiting table is accessible
    const { data, error } = await supabase
      .from('rate_limit_requests')
      .select('id')
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        endpoint: 'rate_limiting',
        status: 'down',
        response_time: responseTime,
        last_checked: new Date().toISOString(),
        error_message: error.message
      };
    }

    return {
      endpoint: 'rate_limiting',
      status: 'healthy',
      response_time: responseTime,
      last_checked: new Date().toISOString()
    };

  } catch (error) {
    return {
      endpoint: 'rate_limiting',
      status: 'down',
      response_time: Date.now() - startTime,
      last_checked: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function getPerformanceMetrics(): Promise<{avg_response_time: number; error_rate: number}> {
  try {
    const supabase = await createClient();
    
    // Get last hour's integration logs for performance metrics
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: logs } = await supabase
      .from('integration_logs')
      .select('status, processing_time_ms')
      .gte('created_at', oneHourAgo);

    if (!logs || logs.length === 0) {
      return { avg_response_time: 0, error_rate: 0 };
    }

    const totalRequests = logs.length;
    const errorRequests = logs.filter(log => log.status === 'error').length;
    const totalResponseTime = logs.reduce((sum, log) => sum + (log.processing_time_ms || 0), 0);

    return {
      avg_response_time: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      error_rate: totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0
    };

  } catch (error) {
    return { avg_response_time: 0, error_rate: 0 };
  }
}