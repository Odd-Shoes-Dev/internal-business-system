import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

interface CreateAPIKeyRequest {
  integration_name: string;
  external_system_id: string;
  permissions: string[];
  allowed_events: string[];
  description?: string;
}

/**
 * POST /api/integrations/api-keys
 * Create a new API key for external system integration
 */
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    // Check if user has admin permissions
    const profileResult = await db.query<{ role: string | null }>(
      'SELECT role FROM user_profiles WHERE id = $1 LIMIT 1',
      [user.id]
    );
    const profile = profileResult.rows[0];

    if (profile?.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Only administrators can create API keys' 
      }, { status: 403 });
    }

    const body: CreateAPIKeyRequest = await request.json();
    const companyId = request.nextUrl.searchParams.get('company_id');
    
    if (!companyId) {
      return NextResponse.json({ 
        error: 'company_id parameter required' 
      }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Validate required fields
    if (!body.integration_name || !body.external_system_id) {
      return NextResponse.json({
        error: 'integration_name and external_system_id are required'
      }, { status: 400 });
    }

    // Generate secure API key
    const apiKey = 'bmp_' + randomBytes(32).toString('hex');

    // Create integration record
    const integrationResult = await db.query(
      `INSERT INTO api_integrations (
         integration_name,
         external_system_id,
         company_id,
         api_key,
         permissions,
         allowed_events,
         description,
         is_active,
         created_by,
         created_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5::text[], $6::text[], $7, true, $8, NOW(), NOW()
       )
       RETURNING *`,
      [
        body.integration_name,
        body.external_system_id,
        companyId,
        apiKey,
        body.permissions || [],
        body.allowed_events || [],
        body.description || null,
        user.id,
      ]
    );
    const integration = integrationResult.rows[0] as any;

    return NextResponse.json({
      success: true,
      data: {
        integration_id: integration.id,
        api_key: apiKey,
        integration_name: integration.integration_name,
        external_system_id: integration.external_system_id,
        permissions: integration.permissions,
        allowed_events: integration.allowed_events,
        created_at: integration.created_at
      },
      message: 'API key created successfully. Store this key securely - it cannot be retrieved again.'
    });

  } catch (error: any) {
    console.error('API key creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integrations/api-keys
 * List all API integrations for a company (without showing the actual keys)
 */
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const companyId = request.nextUrl.searchParams.get('company_id');
    if (!companyId) {
      return NextResponse.json({ 
        error: 'company_id parameter required' 
      }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Get all integrations for the company (without exposing API keys)
    const integrationsResult = await db.query(
      `SELECT ai.id,
              ai.integration_name,
              ai.external_system_id,
              ai.permissions,
              ai.allowed_events,
              ai.description,
              ai.is_active,
              ai.created_at,
              ai.last_used_at,
              json_build_object('full_name', up.full_name) AS created_by_user
       FROM api_integrations ai
       LEFT JOIN user_profiles up ON up.id = ai.created_by
       WHERE ai.company_id = $1
       ORDER BY ai.created_at DESC`,
      [companyId]
    );
    const integrations = integrationsResult.rows as any[];

    return NextResponse.json({
      success: true,
      data: integrations.map((integration: any) => ({
        ...integration,
        api_key_preview: 'bmp_*****' + integration.id.slice(-8) // Show only partial key
      }))
    });

  } catch (error: any) {
    console.error('API keys list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}