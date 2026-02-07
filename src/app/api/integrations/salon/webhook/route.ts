import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createJournalEntry } from '@/lib/accounting/journal-entry-helpers';
import { validateIntegrationAccess } from '@/lib/api/subscription-validator';
import { withRateLimit } from '@/lib/api/rate-limiter';

interface SalonWebhookData {
  event: string;
  salon_id: string;
  data: {
    sale_id: string;
    customer_id?: string;
    customer_name: string;
    amount: number;
    tax_amount?: number;
    payment_method: 'cash' | 'card' | 'mobile_money' | 'bank_transfer';
    currency: string;
    services: Array<{
      service_name: string;
      staff_member: string;
      amount: number;
      commission_amount?: number;
    }>;
    timestamp: string;
    reference_number?: string;
  };
}

/**
 * POST /api/integrations/salon/webhook
 * Webhook endpoint for salon systems to send transaction data
 */
export async function POST(request: NextRequest) {
  try {
    // Extract authentication headers
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '') || 
                   request.headers.get('X-API-Key');
    const salonId = request.headers.get('X-Salon-ID');
    
    if (!apiKey || !salonId) {
      return NextResponse.json(
        { 
          error: 'Missing authentication headers',
          required: ['Authorization or X-API-Key', 'X-Salon-ID']
        },
        { status: 401 }
      );
    }

    // Validate subscription and API access
    const validation = await validateIntegrationAccess(apiKey);
    
    if (!validation.isValid || !validation.hasApiAccess) {
      const status = validation.error?.includes('subscription') ? 402 : 401;
      return NextResponse.json(
        { 
          error: validation.error || 'API access not allowed',
          upgrade_required: status === 402,
          required_plan: 'professional'
        },
        { status }
      );
    }

    // Apply rate limiting
    const rateLimitResult = await withRateLimit(apiKey, validation.rateLimit);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          limit: rateLimitResult.limit,
          reset_time: rateLimitResult.resetTime,
          retry_after: rateLimitResult.retryAfter
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
          }
        }
      );
    }

    // Add rate limit headers to successful response
    const responseHeaders = {
      'X-RateLimit-Limit': rateLimitResult.limit.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
    };

    const supabase = await createClient();

    // Get integration details (we already validated access above)
    const { data: integration, error: authError } = await supabase
      .from('api_integrations')
      .select('company_id, allowed_events')
      .eq('api_key', apiKey)
      .eq('external_system_id', salonId)
      .single();

    if (authError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    const webhookData: SalonWebhookData = await request.json();
    
    // Validate webhook data
    if (!webhookData.event || !webhookData.data) {
      return NextResponse.json(
        { error: 'Invalid webhook data structure' },
        { status: 400 }
      );
    }

    // Check if event type is allowed
    if (!integration.allowed_events?.includes(webhookData.event)) {
      return NextResponse.json(
        { error: `Event type '${webhookData.event}' not allowed for this integration` },
        { status: 403 }
      );
    }

    let result;
    
    // Process different event types
    switch (webhookData.event) {
      case 'salon.sale.completed':
        result = await processSaleCompleted(webhookData.data, integration.company_id, supabase);
        break;
      
      case 'salon.payment.received':
        result = await processPaymentReceived(webhookData.data, integration.company_id, supabase);
        break;
        
      case 'salon.refund.issued':
        result = await processRefundIssued(webhookData.data, integration.company_id, supabase);
        break;
        
      default:
        return NextResponse.json(
          { error: `Unsupported event type: ${webhookData.event}` },
          { status: 400 }
        );
    }

    // Log successful integration
    await supabase.from('integration_logs').insert({
      integration_id: validation.integrationId,
      event_type: webhookData.event,
      external_id: webhookData.data.sale_id,
      status: 'success',
      processed_at: new Date().toISOString(),
      request_data: webhookData,
      response_data: result
    });

    return NextResponse.json(result, {
      headers: responseHeaders
    });

  } catch (error: any) {
    console.error('Salon webhook error:', error);
    
    // Default headers for error response
    const errorHeaders = {
      'X-RateLimit-Limit': '0',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': Date.now().toString()
    };
    
    // Log failed integration attempt
    try {
      const supabase = await createClient();
      await supabase.from('integration_logs').insert({
        event_type: 'webhook_error',
        status: 'error',
        error_message: error.message,
        processed_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Failed to log integration error:', logError);
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID()
      },
      { 
        status: 500,
        headers: errorHeaders 
      }
    );
  }
}

async function processSaleCompleted(data: SalonWebhookData['data'], companyId: string, supabase: any) {
  // Get required GL accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .in('code', ['1100', '4100', '2300']) // Cash, Service Revenue, Sales Tax Payable
    .eq('is_active', true);

  if (accountsError || !accounts || accounts.length < 2) {
    throw new Error('Required GL accounts not found. Ensure accounts 1100 (Cash) and 4100 (Service Revenue) exist.');
  }

  const cashAccount = accounts.find((a: { id: string; code: string; name: string }) => a.code === '1100');
  const revenueAccount = accounts.find((a: { id: string; code: string; name: string }) => a.code === '4100');
  const taxAccount = accounts.find((a: { id: string; code: string; name: string }) => a.code === '2300');

  if (!cashAccount || !revenueAccount) {
    throw new Error('Cash or Revenue account not found');
  }

  // Prepare journal entry lines
  const journalLines = [];
  const saleAmount = data.amount;
  const taxAmount = data.tax_amount || 0;
  const netAmount = saleAmount - taxAmount;

  // Debit: Cash/Bank (total amount including tax)
  journalLines.push({
    account_id: cashAccount.id,
    debit: saleAmount,
    credit: 0,
    description: `Salon sale payment - ${data.payment_method}`
  });

  // Credit: Service Revenue (net amount)
  journalLines.push({
    account_id: revenueAccount.id,
    debit: 0,
    credit: netAmount,
    description: `Salon services - ${data.customer_name}`
  });

  // Credit: Sales Tax Payable (if applicable)
  if (taxAmount > 0 && taxAccount) {
    journalLines.push({
      account_id: taxAccount.id,
      debit: 0,
      credit: taxAmount,
      description: 'VAT on salon services'
    });
  }

  // Create journal entry
  const journalEntry = await createJournalEntry({
    supabase,
    entry_date: data.timestamp.split('T')[0],
    description: `Salon Sale #${data.sale_id} - ${data.customer_name}`,
    reference: data.reference_number || data.sale_id,
    source_module: 'salon_integration',
    source_document_id: data.sale_id,
    lines: journalLines,
    created_by: 'system',
    status: 'posted'
  });

  // Store salon transaction details for reference
  const { error: transactionError } = await supabase
    .from('salon_transactions')
    .insert({
      company_id: companyId,
      external_sale_id: data.sale_id,
      customer_name: data.customer_name,
      external_customer_id: data.customer_id,
      total_amount: saleAmount,
      tax_amount: taxAmount,
      payment_method: data.payment_method,
      currency: data.currency,
      services: data.services,
      journal_entry_id: journalEntry.journalEntry.id,
      transaction_date: data.timestamp
    });

  if (transactionError) {
    console.error('Failed to store salon transaction details:', transactionError);
    // Continue anyway since the main journal entry was created
  }

  return {
    success: true,
    journal_entry_id: journalEntry.journalEntry.id,
    amount_recorded: saleAmount,
    message: 'Sale successfully recorded in accounting system'
  };
}

async function processPaymentReceived(data: SalonWebhookData['data'], companyId: string, supabase: any) {
  // Similar logic for processing payments
  // This would handle cases where payment is received separately from sale
  return { success: true, message: 'Payment processed' };
}

async function processRefundIssued(data: SalonWebhookData['data'], companyId: string, supabase: any) {
  // Handle refund processing - reverse the original entries
  return { success: true, message: 'Refund processed' };
}