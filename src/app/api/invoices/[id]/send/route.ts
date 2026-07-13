import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { sendInvoiceEmail } = await import('@/lib/email/resend');
    const invoiceId = resolvedParams.id;

    // Fetch invoice with customer and company
    const invoiceResult = await db.query<any>(
      'SELECT * FROM invoices WHERE id = $1 LIMIT 1',
      [invoiceId]
    );
    const invoice = invoiceResult.rows[0];

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, invoice.company_id);
    if (companyAccessError) return companyAccessError;

    const customerResult = await db.query<any>(
      'SELECT name, email, email_2, email_3, email_4 FROM customers WHERE id = $1 LIMIT 1',
      [invoice.customer_id]
    );
    const customer = customerResult.rows[0] || null;

    const companyResult = await db.query<any>(
      'SELECT name, email, phone, address, city, country FROM companies WHERE id = $1 LIMIT 1',
      [invoice.company_id]
    );
    const company = companyResult.rows[0] || null;

    if (!company) {
      return NextResponse.json({ error: 'Company information not found' }, { status: 404 });
    }

    if (!customer?.email) {
      return NextResponse.json(
        { error: 'Customer does not have an email address' },
        { status: 400 }
      );
    }

    // Collect all customer email addresses
    const emailAddresses = [
      customer.email,
      customer.email_2,
      customer.email_3,
      customer.email_4,
    ].filter((email): email is string => Boolean(email));

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const paymentLink = `${baseUrl}/pay?invoice=${invoiceId}`;
    const totalAmount = Number(invoice.total ?? invoice.total_amount ?? 0);
    const balanceDue = totalAmount - Number(invoice.amount_paid || 0);
    const currency = invoice.currency || 'USD';

    // Generate PDF attachment from the invoice HTML
    let pdfAttachment: { content: Buffer; filename: string; type: string } | undefined;
    try {
      const { generateInvoiceHTML } = await import('@/lib/pdf/invoice');
      const { generateQuotationHTML } = await import('@/lib/pdf/quotation');
      const { generateProformaHTML } = await import('@/lib/pdf/proforma');
      const { generatePDFFromHTML } = await import('@/lib/pdf/generate');

      const lineItemsResult = await db.query<any>(
        'SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_number ASC',
        [invoiceId]
      );
      const lineItems = lineItemsResult.rows || [];

      const fullCompanyResult = await db.query<any>(
        'SELECT name, logo_url, email, phone, address, city, country, tax_id, registration_number, website FROM companies WHERE id = $1 LIMIT 1',
        [invoice.company_id]
      );
      const fullCompany = fullCompanyResult.rows[0];

      const fullCustomerResult = await db.query<any>(
        'SELECT * FROM customers WHERE id = $1 LIMIT 1',
        [invoice.customer_id]
      );
      const fullCustomer = fullCustomerResult.rows[0] || {};

      const pdfData = { invoice, lineItems, customer: fullCustomer, company: fullCompany };
      const documentType = invoice.document_type || 'invoice';
      let html: string;
      if (documentType === 'quotation') html = generateQuotationHTML(pdfData);
      else if (documentType === 'proforma') html = generateProformaHTML(pdfData);
      else html = generateInvoiceHTML(pdfData);

      const pdfBuffer = await generatePDFFromHTML(html);
      if (pdfBuffer) {
        pdfAttachment = {
          content: pdfBuffer,
          filename: `${invoice.invoice_number}.pdf`,
          type: 'application/pdf',
        };
      }
    } catch (pdfError) {
      console.warn('PDF generation skipped:', pdfError);
    }

    // Send email to all addresses
    await sendInvoiceEmail({
      to: emailAddresses.join(', '),
      customerName: customer.name,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      totalAmount,
      balanceDue,
      currency,
      paymentLink,
      pdfAttachment,
      company: {
        name: company.name,
        email: company.email,
        phone: company.phone || undefined,
        address: company.address || undefined,
        city: company.city || undefined,
        country: company.country || undefined,
      },
    });

    // Update invoice status to sent if it was draft
    if (invoice.status === 'draft') {
      await db.query('UPDATE invoices SET status = $2, updated_at = NOW() WHERE id = $1', [
        invoiceId,
        'sent',
      ]);
    }

    return NextResponse.json({
      success: true,
      message: `Invoice sent to ${emailAddresses.length} email address${emailAddresses.length > 1 ? 'es' : ''}`,
      hasPDF: !!pdfAttachment,
    });
  } catch (error: any) {
    console.error('Error sending invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send invoice' },
      { status: 500 }
    );
  }
}
