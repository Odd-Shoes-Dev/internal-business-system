import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, supabaseKey);
    const { sendInvoiceEmail } = await import('@/lib/email/resend');
    const invoiceId = params.id;

    // Fetch invoice with customer
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(name, email, email_2, email_3, email_4)
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (!invoice.customer?.email) {
      return NextResponse.json(
        { error: 'Customer does not have an email address' },
        { status: 400 }
      );
    }

    // Collect all customer email addresses
    const emailAddresses = [
      invoice.customer.email,
      invoice.customer.email_2,
      invoice.customer.email_3,
      invoice.customer.email_4,
    ].filter((email): email is string => Boolean(email));

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const paymentLink = `${baseUrl}/pay?invoice=${invoiceId}`;
    const balanceDue = Number(invoice.total_amount) - Number(invoice.amount_paid);

    // Send email to all addresses
    await sendInvoiceEmail({
      to: emailAddresses.join(', '),
      customerName: invoice.customer.name,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      totalAmount: Number(invoice.total_amount),
      balanceDue,
      paymentLink,
    });

    // Update invoice status to sent if it was draft
    if (invoice.status === 'draft') {
      await supabase
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', invoiceId);
    }

    return NextResponse.json({ 
      success: true,
      message: `Invoice sent to ${emailAddresses.length} email address${emailAddresses.length > 1 ? 'es' : ''}` 
    });
  } catch (error: any) {
    console.error('Error sending invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send invoice' },
      { status: 500 }
    );
  }
}
