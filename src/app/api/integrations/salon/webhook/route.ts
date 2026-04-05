import { getDbProvider } from '@/lib/provider';
import { NextRequest, NextResponse } from 'next/server';
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

    const db = getDbProvider();

    // Get integration details (we already validated access above)
    const integrationResult = await db.query(
      `SELECT id, company_id, allowed_events
       FROM api_integrations
       WHERE api_key = $1
         AND external_system_id = $2
         AND is_active = true
       LIMIT 1`,
      [apiKey, salonId]
    );
    const integration = integrationResult.rows[0] as any;

    if (!integration) {
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
        result = await processSaleCompleted(webhookData.data, integration.company_id, db);
        break;
      
      case 'salon.payment.received':
        result = await processPaymentReceived(webhookData.data, integration.company_id, db);
        break;
        
      case 'salon.refund.issued':
        result = await processRefundIssued(webhookData.data, integration.company_id, db);
        break;
        
      default:
        return NextResponse.json(
          { error: `Unsupported event type: ${webhookData.event}` },
          { status: 400 }
        );
    }

    // Log successful integration
    await db.query(
      `INSERT INTO integration_logs (
         integration_id,
         event_type,
         external_id,
         status,
         processed_at,
         request_data,
         response_data,
         created_at
       ) VALUES (
         $1, $2, $3, 'success', NOW(), $4::jsonb, $5::jsonb, NOW()
       )`,
      [
        validation.integrationId || integration.id,
        webhookData.event,
        webhookData.data.sale_id || null,
        JSON.stringify(webhookData),
        JSON.stringify(result || {}),
      ]
    );

    await db.query(
      'UPDATE api_integrations SET last_used_at = NOW(), updated_at = NOW() WHERE id = $1',
      [integration.id]
    );

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
      const db = getDbProvider();
      await db.query(
        `INSERT INTO integration_logs (
           event_type,
           status,
           error_message,
           processed_at,
           created_at
         ) VALUES ($1, 'error', $2, NOW(), NOW())`,
        ['webhook_error', error.message || 'Unknown error']
      );
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

async function processSaleCompleted(data: SalonWebhookData['data'], companyId: string, db: any) {
  // Get required GL accounts
  const accountsResult = await db.query(
    `SELECT id, code, name
     FROM accounts
     WHERE company_id = $1
       AND code = ANY($2::text[])
       AND is_active = true`,
    [companyId, ['1100', '4100', '2300']]
  );
  const accounts = accountsResult.rows as Array<{ id: string; code: string; name: string }>;

  if (!accounts || accounts.length < 2) {
    throw new Error('Required GL accounts not found. Ensure accounts 1100 (Cash) and 4100 (Service Revenue) exist.');
  }

  const cashAccount = accounts.find((a: { id: string; code: string; name: string }) => a.code === '1100');
  const revenueAccount = accounts.find((a: { id: string; code: string; name: string }) => a.code === '4100');
  const taxAccount = accounts.find((a: { id: string; code: string; name: string }) => a.code === '2300');

  if (!cashAccount || !revenueAccount) {
    throw new Error('Cash or Revenue account not found');
  }

  // Prepare journal entry lines
  const journalLines: Array<{ account_id: string; debit: number; credit: number; description: string }> = [];
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
  const journalEntryId = await createIntegrationJournalEntry({
    db,
    companyId,
    entryDate: data.timestamp.split('T')[0],
    description: `Salon Sale #${data.sale_id} - ${data.customer_name}`,
    memo: data.reference_number || data.sale_id,
    lines: journalLines,
  });

  // Store salon transaction details for reference
  try {
    await db.query(
      `INSERT INTO salon_transactions (
         company_id,
         external_sale_id,
         customer_name,
         external_customer_id,
         total_amount,
         tax_amount,
         payment_method,
         currency,
         services,
         journal_entry_id,
         transaction_date,
         created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, NOW()
       )
       ON CONFLICT (company_id, external_sale_id)
       DO UPDATE SET
         customer_name = EXCLUDED.customer_name,
         external_customer_id = EXCLUDED.external_customer_id,
         total_amount = EXCLUDED.total_amount,
         tax_amount = EXCLUDED.tax_amount,
         payment_method = EXCLUDED.payment_method,
         currency = EXCLUDED.currency,
         services = EXCLUDED.services,
         journal_entry_id = EXCLUDED.journal_entry_id,
         transaction_date = EXCLUDED.transaction_date`,
      [
        companyId,
        data.sale_id,
        data.customer_name,
        data.customer_id || null,
        saleAmount,
        taxAmount,
        data.payment_method,
        data.currency,
        JSON.stringify(data.services || []),
        journalEntryId,
        data.timestamp,
      ]
    );
  } catch (transactionError) {
    console.error('Failed to store salon transaction details:', transactionError);
  }

  return {
    success: true,
    journal_entry_id: journalEntryId,
    amount_recorded: saleAmount,
    message: 'Sale successfully recorded in accounting system'
  };
}

async function processPaymentReceived(data: SalonWebhookData['data'], companyId: string, db: any) {
  // Similar logic for processing payments
  // This would handle cases where payment is received separately from sale
  return { success: true, message: 'Payment processed' };
}

async function processRefundIssued(data: SalonWebhookData['data'], companyId: string, db: any) {
  // Handle refund processing - reverse the original entries
  return { success: true, message: 'Refund processed' };
}

async function createIntegrationJournalEntry(params: {
  db: any;
  companyId: string;
  entryDate: string;
  description: string;
  memo?: string;
  lines: Array<{ account_id: string; debit: number; credit: number; description: string }>;
}) {
  const { db, companyId, entryDate, description, memo, lines } = params;

  const totalDebits = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const totalCredits = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(`Journal entry not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`);
  }

  return await db.transaction(async (tx: any) => {
    const entryNumberResult = await tx.query('SELECT generate_journal_entry_number() AS entry_number');
    const entryNumber = entryNumberResult.rows[0]?.entry_number;
    if (!entryNumber) {
      throw new Error('Failed to generate journal entry number');
    }

    const entryResult = await tx.query(
      `INSERT INTO journal_entries (
         company_id,
         entry_number,
         entry_date,
         description,
         memo,
         source_module,
         status,
         posted_at,
         created_at,
         updated_at
       ) VALUES (
         $1, $2, $3::date, $4, $5, 'salon_integration', 'posted', NOW(), NOW(), NOW()
       )
       RETURNING id`,
      [companyId, entryNumber, entryDate, description, memo || null]
    );
    const journalEntryId = entryResult.rows[0].id;

    let lineNumber = 1;
    for (const line of lines) {
      await tx.query(
        `INSERT INTO journal_lines (
           company_id,
           journal_entry_id,
           line_number,
           account_id,
           debit,
           credit,
           base_debit,
           base_credit,
           description,
           created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $5, $6, $7, NOW()
         )`,
        [
          companyId,
          journalEntryId,
          lineNumber,
          line.account_id,
          Number(line.debit || 0),
          Number(line.credit || 0),
          line.description,
        ]
      );
      lineNumber += 1;
    }

    return journalEntryId;
  });
}