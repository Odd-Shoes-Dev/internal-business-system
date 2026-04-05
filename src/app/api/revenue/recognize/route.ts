import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/revenue/recognize - Recognize deferred revenue for completed services
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    const {
      invoice_id,
      recognition_date,
      amount, // Optional: partial recognition
    } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 });
    }

    // Get invoice details
    const invoiceResult = await db.query(
      `SELECT i.*,
              c.id AS customer_ref_id,
              c.name AS customer_name,
              b.id AS booking_ref_id,
              b.booking_number,
              b.status AS booking_status
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       LEFT JOIN bookings b ON b.id = i.booking_id
       WHERE i.id = $1
       LIMIT 1`,
      [invoice_id]
    );
    const invoice = invoiceResult.rows[0];

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, invoice.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Validation checks
    if (!invoice.is_advance_payment) {
      return NextResponse.json(
        { error: 'This invoice is not marked as advance payment/deferred revenue' },
        { status: 400 }
      );
    }

    if (invoice.revenue_recognized_amount >= invoice.total) {
      return NextResponse.json(
        { error: 'Revenue has already been fully recognized for this invoice' },
        { status: 400 }
      );
    }

    // Calculate amount to recognize
    const remainingAmount = invoice.total - (invoice.revenue_recognized_amount || 0);
    const recognitionAmount = amount ? Math.min(amount, remainingAmount) : remainingAmount;

    if (recognitionAmount <= 0) {
      return NextResponse.json(
        { error: 'No amount available to recognize' },
        { status: 400 }
      );
    }

    // Get accounts
    const accountsResult = await db.query(
      `SELECT id, code
       FROM accounts
       WHERE code = ANY($1)
         AND (company_id = $2 OR company_id IS NULL)
       ORDER BY (company_id = $2) DESC`,
      [['2100', '4100'], invoice.company_id]
    );
    const accountMap = new Map<string, string>();
    for (const row of accountsResult.rows as any[]) {
      if (!accountMap.has(row.code)) {
        accountMap.set(row.code, row.id);
      }
    }

    const unearnedRevenueId = accountMap.get('2100');
    const tourRevenueId = accountMap.get('4100');

    if (!unearnedRevenueId || !tourRevenueId) {
      return NextResponse.json(
        { error: 'Required revenue accounts not found (2100 Unearned Revenue, 4100 Tour Revenue)' },
        { status: 400 }
      );
    }

    const journalEntryId = await db.transaction(async (tx) => {
      const entryNumberResult = await tx.query('SELECT generate_journal_entry_number() AS entry_number');
      const entryNumber = entryNumberResult.rows[0]?.entry_number;
      if (!entryNumber) {
        throw new Error('Failed to generate journal entry number');
      }

      const entryDate = recognition_date || new Date().toISOString().split('T')[0];

      const entryResult = await tx.query(
        `INSERT INTO journal_entries (
           company_id, entry_number, entry_date, description,
           source_module, source_document_id, status, created_by,
           posted_by, posted_at
         ) VALUES (
           $1, $2, $3::date, $4,
           'revenue_recognition', $5, 'posted', $6,
           $6, NOW()
         )
         RETURNING id`,
        [
          invoice.company_id,
          entryNumber,
          entryDate,
          `Revenue recognition for Invoice ${invoice.invoice_number}`,
          invoice.id,
          user.id,
        ]
      );

      const journalEntryId = entryResult.rows[0]?.id;
      if (!journalEntryId) {
        throw new Error('Failed to create journal entry');
      }

      await tx.query(
        `INSERT INTO journal_lines (
           company_id, journal_entry_id, line_number, account_id, debit, credit, description
         ) VALUES
           ($1, $2, 1, $3, $4, 0, $5),
           ($1, $2, 2, $6, 0, $4, $7)`,
        [
          invoice.company_id,
          journalEntryId,
          unearnedRevenueId,
          recognitionAmount,
          `Recognize revenue - Invoice ${invoice.invoice_number}`,
          tourRevenueId,
          `Earned revenue - Invoice ${invoice.invoice_number}`,
        ]
      );

      const newRecognizedAmount = Number(invoice.revenue_recognized_amount || 0) + Number(recognitionAmount);
      const isFullyRecognized = newRecognizedAmount >= Number(invoice.total || 0);

      await tx.query(
        `UPDATE invoices
         SET revenue_recognized_amount = $2,
             revenue_recognition_date = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [
          invoice_id,
          newRecognizedAmount,
          isFullyRecognized ? (recognition_date || new Date().toISOString().split('T')[0]) : invoice.revenue_recognition_date,
        ]
      );

      return journalEntryId;
    });

    // Update response values
    const newRecognizedAmount = Number(invoice.revenue_recognized_amount || 0) + Number(recognitionAmount);
    const isFullyRecognized = newRecognizedAmount >= invoice.total;

    return NextResponse.json({
      message: 'Revenue recognized successfully',
      recognized_amount: recognitionAmount,
      total_recognized: newRecognizedAmount,
      remaining: invoice.total - newRecognizedAmount,
      fully_recognized: isFullyRecognized,
      journal_entry_id: journalEntryId,
    });

  } catch (error: any) {
    console.error('Error recognizing revenue:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/revenue/recognize-batch - Automatically recognize revenue for completed tours
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const asOf = searchParams.get('as_of') || new Date().toISOString().split('T')[0];
    const autoRecognize = searchParams.get('auto_recognize') === 'true';
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Find invoices with unrecognized revenue where service has been completed
    const invoicesResult = await db.query(
      `SELECT i.*,
              c.name AS customer_name,
              b.booking_number,
              b.status AS booking_status,
              b.travel_end_date
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       LEFT JOIN bookings b ON b.id = i.booking_id
       WHERE i.company_id = $1
         AND i.is_advance_payment = true
         AND i.service_end_date <= $2::date
         AND (i.revenue_recognition_date IS NULL OR COALESCE(i.revenue_recognized_amount, 0) < i.total)
       ORDER BY i.service_end_date ASC`,
      [companyId, asOf]
    );

    const invoices = invoicesResult.rows;

    const eligible = invoices?.filter(inv => 
      (inv.revenue_recognized_amount || 0) < inv.total
    ) || [];

    if (autoRecognize) {
      // Automatically recognize revenue for all eligible invoices
      const results = [];
      
      for (const invoice of eligible) {
        const recognitionAmount = invoice.total - (invoice.revenue_recognized_amount || 0);
        
        // This would call the POST endpoint for each invoice
        // For now, just return the list
        results.push({
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount_to_recognize: recognitionAmount,
          service_end_date: invoice.service_end_date,
        });
      }

      return NextResponse.json({
        message: `Found ${eligible.length} invoices ready for revenue recognition`,
        total_amount: eligible.reduce((sum, inv) => sum + (inv.total - (inv.revenue_recognized_amount || 0)), 0),
        invoices: results,
      });
    }

    return NextResponse.json({
      count: eligible.length,
      total_unrecognized: eligible.reduce((sum, inv) => sum + (inv.total - (inv.revenue_recognized_amount || 0)), 0),
      invoices: eligible.map(inv => ({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: inv.customer_name,
        total: inv.total,
        recognized: inv.revenue_recognized_amount || 0,
        unrecognized: inv.total - (inv.revenue_recognized_amount || 0),
        service_end_date: inv.service_end_date,
        booking_number: inv.booking_number,
      })),
    });

  } catch (error: any) {
    console.error('Error fetching unrecognized revenue:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
