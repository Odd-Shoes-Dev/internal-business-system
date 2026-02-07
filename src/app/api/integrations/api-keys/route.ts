import { createClient } from '@/lib/supabase/server';
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
    const supabase = await createClient();
    
    // Verify user authentication and permissions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

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

    // Validate required fields
    if (!body.integration_name || !body.external_system_id) {
      return NextResponse.json({
        error: 'integration_name and external_system_id are required'
      }, { status: 400 });
    }

    // Generate secure API key
    const apiKey = 'bmp_' + randomBytes(32).toString('hex');

    // Create integration record
    const { data: integration, error: insertError } = await supabase
      .from('api_integrations')
      .insert({
        integration_name: body.integration_name,
        external_system_id: body.external_system_id,
        company_id: companyId,
        api_key: apiKey,
        permissions: body.permissions || [],
        allowed_events: body.allowed_events || [],
        description: body.description,
        is_active: true,
        created_by: user.id
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({
        error: 'Failed to create integration',
        details: insertError.message
      }, { status: 400 });
    }

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
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = request.nextUrl.searchParams.get('company_id');
    if (!companyId) {
      return NextResponse.json({ 
        error: 'company_id parameter required' 
      }, { status: 400 });
    }

    // Get all integrations for the company (without exposing API keys)
    const { data: integrations, error } = await supabase
      .from('api_integrations')
      .select(`
        id,
        integration_name,
        external_system_id,
        permissions,
        allowed_events,
        description,
        is_active,
        created_at,
        last_used_at,
        created_by_user:user_profiles!api_integrations_created_by_fkey(full_name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({
        error: 'Failed to fetch integrations',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: integrations?.map(integration => ({
        ...integration,
        api_key_preview: 'bmp_*****' + integration.id.slice(-8) // Show only partial key
      })) || []
    });

  } catch (error: any) {
    console.error('API keys list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}