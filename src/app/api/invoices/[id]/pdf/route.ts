import { NextRequest, NextResponse } from 'next/server';
import { generateInvoiceHTML } from '@/lib/pdf/invoice';
import { generateQuotationHTML } from '@/lib/pdf/quotation';
import { generateProformaHTML } from '@/lib/pdf/proforma';
import { generateReceiptHTML } from '@/lib/pdf/receipt';

export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    // Create service-role Supabase client on demand so builds without service keys don't
    // crash during module evaluation. If the key is missing, return a clear error.
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, supabaseKey);
    const invoiceId = params.id;

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Fetch customer
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', invoice.customer_id)
      .single();

    // Fetch company info
    const { data: company } = await supabase
      .from('companies')
      .select('name, logo_url, email, phone, address, city, country, tax_id, registration_number, website')
      .eq('id', invoice.company_id)
      .single();

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Fetch line items
    const { data: lineItems } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('line_number');

    // Generate HTML for PDF based on document type
    let html: string;
    const documentType = invoice.document_type || 'invoice';
    const pdfData = {
      invoice,
      lineItems: lineItems || [],
      customer: customer || {},
      company: company,
    };

    switch (documentType) {
      case 'quotation':
        html = generateQuotationHTML(pdfData);
        break;
      case 'proforma':
        html = generateProformaHTML(pdfData);
        break;
      case 'receipt':
        html = generateReceiptHTML(pdfData);
        break;
      default:
        html = generateInvoiceHTML(pdfData);
    }

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
