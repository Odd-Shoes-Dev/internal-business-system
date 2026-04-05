import { NextRequest, NextResponse } from 'next/server';
import {
  asQueryExecutor,
  createInvoiceJournalEntryWithDb,
  reduceInventoryForInvoiceWithDb,
  reserveInventoryForQuotationWithDb,
  validatePeriodLockWithDb,
} from '@/lib/accounting/provider-accounting';
import {
  getCompanyIdFromRequest,
  requireCompanyAccess,
  requireSessionUser,
} from '@/lib/provider/route-guards';

// GET /api/invoices - List invoices
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const where: string[] = ['i.company_id = $1'];
    const params: any[] = [companyId];

    if (status && status !== 'all') {
      params.push(status);
      where.push(`i.status = $${params.length}`);
    }

    if (customerId) {
      params.push(customerId);
      where.push(`i.customer_id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`i.invoice_number ILIKE $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countResult = await db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM invoices i
       ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const dataResult = await db.query(
      `SELECT i.*, c.id AS customer_ref_id, c.name AS customer_name, c.email AS customer_email
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       ${whereSql}
       ORDER BY i.invoice_date DESC
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const data = dataResult.rows.map((row) => ({
      ...row,
      customers: row.customer_ref_id
        ? {
            id: row.customer_ref_id,
            name: row.customer_name,
            email: row.customer_email,
          }
        : null,
    }));

    const count = Number(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/invoices - Create invoice
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    const { company_id, ...invoiceData } = body;

    // Multi-tenant: Validate company_id
    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Validate required fields
    if (!invoiceData.customer_id || !invoiceData.invoice_date || !invoiceData.due_date) {
      return NextResponse.json(
        { error: 'Missing required fields: customer_id, invoice_date, due_date' },
        { status: 400 }
      );
    }

    const companyAccessError = await requireCompanyAccess(user.id, company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const periodError = await validatePeriodLockWithDb(
      asQueryExecutor(db),
      invoiceData.invoice_date,
      company_id
    );
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 403 });
    }

    // Determine document type and generate appropriate number
    const documentType = invoiceData.document_type || 'invoice';
    let documentNumber;
    let numberField;

    switch (documentType) {
      case 'quotation':
        documentNumber = (
          await db.query<{ value: string }>('SELECT generate_quotation_number() AS value')
        ).rows[0]?.value;
        numberField = 'quotation_number';
        break;

      case 'proforma':
        documentNumber = (
          await db.query<{ value: string }>('SELECT generate_proforma_number() AS value')
        ).rows[0]?.value;
        numberField = 'proforma_number';
        break;

      case 'receipt':
        documentNumber = (
          await db.query<{ value: string }>('SELECT generate_receipt_number() AS value')
        ).rows[0]?.value;
        numberField = 'receipt_number';
        break;

      default: // invoice
        documentNumber = (
          await db.query<{ value: string }>('SELECT generate_invoice_number() AS value')
        ).rows[0]?.value;
        numberField = 'invoice_number';
    }

    if (!documentNumber) {
      return NextResponse.json({ error: 'Failed to generate document number' }, { status: 500 });
    }

    // Get AR account
    const arAccount = await db.query<{ id: string }>('SELECT id FROM accounts WHERE code = $1 LIMIT 1', [
      '1200',
    ]);

    // Calculate totals from lines
    const lines = invoiceData.lines || [];
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    lines.forEach((line: any) => {
      const lineSubtotal = line.quantity * line.unit_price;
      const lineDiscount = lineSubtotal * ((line.discount_percent || 0) / 100);
      const lineNet = lineSubtotal - lineDiscount;
      const lineTax = lineNet * (line.tax_rate || 0);

      subtotal += lineNet;
      taxAmount += lineTax;
      discountAmount += lineDiscount;
    });

    const total = subtotal + taxAmount;

    // Build invoice data object with appropriate number field
    const invoiceDataToInsert: any = {
      company_id,
      customer_id: invoiceData.customer_id,
      invoice_date: invoiceData.invoice_date,
      due_date: invoiceData.due_date,
      payment_terms: invoiceData.payment_terms || 30,
      po_number: invoiceData.po_number || null,
      notes: invoiceData.notes || null,
      currency: invoiceData.currency || 'USD',
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
      amount_paid: 0,
      status: invoiceData.status || 'draft',
      ar_account_id: arAccount.rows[0]?.id || null,
      created_by: user.id,
      document_type: documentType,
      ...(invoiceData.booking_id && { booking_id: invoiceData.booking_id }), // Include booking_id if provided
    };

    // Add the appropriate number field
    if (documentType === 'quotation') {
      invoiceDataToInsert.quotation_number = documentNumber;
      invoiceDataToInsert.invoice_number = `TEMP-${Date.now()}`; // Temporary placeholder
    } else if (documentType === 'proforma') {
      invoiceDataToInsert.proforma_number = documentNumber;
      invoiceDataToInsert.invoice_number = `TEMP-${Date.now()}`; // Temporary placeholder
    } else if (documentType === 'receipt') {
      invoiceDataToInsert.receipt_number = documentNumber;
      invoiceDataToInsert.invoice_number = `TEMP-${Date.now()}`; // Temporary placeholder
    } else {
      invoiceDataToInsert.invoice_number = documentNumber;
    }

    const createdInvoice = await db.transaction(async (tx) => {
      const invoiceInsert = await tx.query<any>(
        `INSERT INTO invoices (
           company_id, customer_id, invoice_date, due_date, payment_terms, po_number,
           notes, currency, subtotal, tax_amount, discount_amount, total, amount_paid,
           status, ar_account_id, created_by, document_type, booking_id,
           invoice_number, quotation_number, proforma_number, receipt_number
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12, 0,
           $13, $14, $15, $16, $17,
           $18, $19, $20, $21
         )
         RETURNING *`,
        [
          invoiceDataToInsert.company_id,
          invoiceDataToInsert.customer_id,
          invoiceDataToInsert.invoice_date,
          invoiceDataToInsert.due_date,
          invoiceDataToInsert.payment_terms,
          invoiceDataToInsert.po_number,
          invoiceDataToInsert.notes,
          invoiceDataToInsert.currency,
          invoiceDataToInsert.subtotal,
          invoiceDataToInsert.tax_amount,
          invoiceDataToInsert.discount_amount,
          invoiceDataToInsert.total,
          invoiceDataToInsert.status,
          invoiceDataToInsert.ar_account_id,
          invoiceDataToInsert.created_by,
          invoiceDataToInsert.document_type,
          invoiceDataToInsert.booking_id || null,
          invoiceDataToInsert.invoice_number || null,
          invoiceDataToInsert.quotation_number || null,
          invoiceDataToInsert.proforma_number || null,
          invoiceDataToInsert.receipt_number || null,
        ]
      );

      const invoice = invoiceInsert.rows[0];

      const invoiceLines = lines.map((line: any, index: number) => {
        const lineSubtotal = line.quantity * line.unit_price;
        const lineDiscount = lineSubtotal * ((line.discount_percent || 0) / 100);
        const lineNet = lineSubtotal - lineDiscount;
        const lineTax = lineNet * (line.tax_rate || 0);
        const lineTotal = lineNet + lineTax; // Total includes tax

        return {
          invoice_id: invoice.id,
          line_number: index + 1,
          product_id: line.product_id || null,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_percent: line.discount_percent || 0,
          discount_amount: lineDiscount,
          tax_rate: line.tax_rate || 0,
          tax_amount: lineTax,
          line_total: lineTotal,
        };
      });

      for (const line of invoiceLines) {
        await tx.query(
          `INSERT INTO invoice_lines (
             invoice_id, line_number, product_id, description, quantity,
             unit_price, discount_percent, discount_amount, tax_rate, tax_amount, line_total
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10, $11
           )`,
          [
            line.invoice_id,
            line.line_number,
            line.product_id,
            line.description,
            line.quantity,
            line.unit_price,
            line.discount_percent,
            line.discount_amount,
            line.tax_rate,
            line.tax_amount,
            line.line_total,
          ]
        );
      }

      if (documentType === 'quotation' || documentType === 'proforma') {
        const reserveResult = await reserveInventoryForQuotationWithDb(tx, invoice.id, lines, user.id);
        if (!reserveResult.success) {
          throw new Error(reserveResult.error || 'Failed to reserve inventory');
        }
      } else if (documentType === 'invoice' && (invoice.status === 'posted' || invoice.status === 'sent')) {
        const inventoryResult = await reduceInventoryForInvoiceWithDb(tx, invoice.id, lines, user.id);
        if (!inventoryResult.success) {
          throw new Error(inventoryResult.error || 'Insufficient inventory');
        }
      }

      if (invoice.status === 'posted' && documentType === 'invoice') {
        const journalResult = await createInvoiceJournalEntryWithDb(
          tx,
          {
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            invoice_date: invoice.invoice_date,
            total: Number(invoice.total),
          },
          user.id
        );

        if (!journalResult.success) {
          throw new Error(journalResult.error || 'Failed to create journal entry for invoice');
        }

        if (journalResult.journalEntryId) {
          await tx.query('UPDATE invoices SET journal_entry_id = $2 WHERE id = $1', [
            invoice.id,
            journalResult.journalEntryId,
          ]);
          invoice.journal_entry_id = journalResult.journalEntryId;
        }
      }

      return invoice;
    });

    return NextResponse.json({ data: createdInvoice }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

