import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createInvoiceJournalEntry } from '@/lib/accounting/journal-entry-helpers';
import { validatePeriodLock } from '@/lib/accounting/period-lock';
import {
  reduceInventoryForInvoice,
  reserveInventoryForQuotation,
  releaseReservedInventory,
} from '@/lib/accounting/inventory-server';

// GET /api/invoices - List invoices
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Multi-tenant: Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Multi-tenant: Get company_id from query params
    const companyId = searchParams.get('company_id');
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Multi-tenant: Verify user has access to this company
    const { data: membership } = await supabase
      .from('user_companies')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
    }
    
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('invoices')
      .select(`
        *,
        customers (id, name, email)
      `, { count: 'exact' })
      .order('invoice_date', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (search) {
      query = query.or(`invoice_number.ilike.%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
    const supabase = await createClient();
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

    // Check if period is closed
    const periodError = await validatePeriodLock(supabase, invoiceData.invoice_date);
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 403 });
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Multi-tenant: Verify user has access to this company
    const { data: membership } = await supabase
      .from('user_companies')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', company_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
    }

    // Determine document type and generate appropriate number
    const documentType = invoiceData.document_type || 'invoice';
    let documentNumber;
    let numberField;

    switch (documentType) {
      case 'quotation':
        const { data: quotationNum, error: quotationErr } = await supabase.rpc('generate_quotation_number');
        if (quotationErr) {
          return NextResponse.json({ error: 'Failed to generate quotation number' }, { status: 500 });
        }
        documentNumber = quotationNum;
        numberField = 'quotation_number';
        break;
      
      case 'proforma':
        const { data: proformaNum, error: proformaErr } = await supabase.rpc('generate_proforma_number');
        if (proformaErr) {
          return NextResponse.json({ error: 'Failed to generate proforma number' }, { status: 500 });
        }
        documentNumber = proformaNum;
        numberField = 'proforma_number';
        break;
      
      case 'receipt':
        const { data: receiptNum, error: receiptErr } = await supabase.rpc('generate_receipt_number');
        if (receiptErr) {
          return NextResponse.json({ error: 'Failed to generate receipt number' }, { status: 500 });
        }
        documentNumber = receiptNum;
        numberField = 'receipt_number';
        break;
      
      default: // invoice
        const { data: invoiceNum, error: invoiceErr } = await supabase.rpc('generate_invoice_number');
        if (invoiceErr) {
          return NextResponse.json({ error: 'Failed to generate invoice number' }, { status: 500 });
        }
        documentNumber = invoiceNum;
        numberField = 'invoice_number';
    }

    // Get AR account
    const { data: arAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', '1200')
      .single();

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
      ar_account_id: arAccount?.id,
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

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoiceDataToInsert)
      .select()
      .single();

    if (invoiceError) {
      return NextResponse.json({ error: invoiceError.message }, { status: 400 });
    }

    // Create invoice lines
    if (lines.length > 0) {
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

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(invoiceLines);

      if (linesError) {
        // Rollback invoice if lines fail
        await supabase.from('invoices').delete().eq('id', invoice.id);
        return NextResponse.json({ error: linesError.message }, { status: 400 });
      }
    }

    // Handle inventory based on document type and status
    if (documentType === 'quotation' || documentType === 'proforma') {
      // Reserve inventory for quotations and proformas
      const reserveResult = await reserveInventoryForQuotation(
        supabase,
        invoice.id,
        lines,
        user.id
      );

      if (!reserveResult.success) {
        // Rollback invoice if reservation fails
        await supabase.from('invoices').delete().eq('id', invoice.id);
        return NextResponse.json(
          { error: reserveResult.error || 'Failed to reserve inventory' },
          { status: 400 }
        );
      }
    } else if (documentType === 'invoice' && (invoice.status === 'posted' || invoice.status === 'sent')) {
      // Reduce inventory for posted/sent invoices
      const inventoryResult = await reduceInventoryForInvoice(
        supabase,
        invoice.id,
        lines,
        user.id
      );

      if (!inventoryResult.success) {
        // Rollback invoice if inventory reduction fails
        await supabase.from('invoices').delete().eq('id', invoice.id);
        return NextResponse.json(
          { error: inventoryResult.error || 'Insufficient inventory' },
          { status: 400 }
        );
      }
    }

    // Create journal entry if invoice is posted
    if (invoice.status === 'posted' && documentType === 'invoice') {
      const journalResult = await createInvoiceJournalEntry(
        supabase,
        {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          total: invoice.total,
          customer_id: invoice.customer_id,
        },
        user.id
      );

      if (!journalResult.success) {
        console.error('Failed to create journal entry for invoice:', journalResult.error);
        // Don't fail the invoice creation, just log the error
      }
    }

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
