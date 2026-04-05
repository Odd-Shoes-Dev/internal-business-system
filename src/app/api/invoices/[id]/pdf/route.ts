import { NextRequest, NextResponse } from 'next/server';
import { generateInvoiceHTML } from '@/lib/pdf/invoice';
import { generateQuotationHTML } from '@/lib/pdf/quotation';
import { generateProformaHTML } from '@/lib/pdf/proforma';
import { generateReceiptHTML } from '@/lib/pdf/receipt';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const invoiceId = resolvedParams.id;

    // Fetch invoice
    const invoiceResult = await db.query<any>(
      'SELECT * FROM invoices WHERE id = $1 LIMIT 1',
      [invoiceId]
    );
    const invoice = invoiceResult.rows[0];

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const companyAccessError = await requireCompanyAccess(user.id, invoice.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Fetch customer
    const customerResult = await db.query<any>(
      'SELECT * FROM customers WHERE id = $1 LIMIT 1',
      [invoice.customer_id]
    );
    const customer = customerResult.rows[0] || null;

    // Fetch company info
    const companyResult = await db.query<any>(
      `SELECT name, logo_url, email, phone, address, city, country, tax_id, registration_number, website
       FROM companies
       WHERE id = $1
       LIMIT 1`,
      [invoice.company_id]
    );
    const company = companyResult.rows[0];

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Fetch line items
    const lineItemsResult = await db.query<any>(
      `SELECT *
       FROM invoice_lines
       WHERE invoice_id = $1
       ORDER BY line_number ASC`,
      [invoiceId]
    );
    const lineItems = lineItemsResult.rows || [];

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
