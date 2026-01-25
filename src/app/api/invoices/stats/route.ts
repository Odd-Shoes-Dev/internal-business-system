import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch all invoices with their currencies
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('total, amount_paid, due_date, status, currency, invoice_date');

    if (error) throw error;

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({
        totalUnpaid: 0,
        dueThisWeek: 0,
        overdue: 0,
        paidThisMonth: 0,
      });
    }

    const now = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Convert all amounts to USD
    let totalUnpaid = 0;
    let dueThisWeek = 0;
    let overdue = 0;
    let paidThisMonth = 0;

    for (const invoice of invoices) {
      const remaining = invoice.total - (invoice.amount_paid || 0);
      const dueDate = new Date(invoice.due_date);
      const invoiceDate = new Date(invoice.invoice_date);

      // Convert to USD
      let amountInUSD = invoice.total;
      let remainingInUSD = remaining;

      if (invoice.currency !== 'USD') {
        // Use RPC function to convert
        const { data: convertedTotal } = await supabase.rpc('convert_currency', {
          p_amount: invoice.total,
          p_from_currency: invoice.currency,
          p_to_currency: 'USD',
          p_date: invoice.invoice_date,
        });

        const { data: convertedRemaining } = await supabase.rpc('convert_currency', {
          p_amount: remaining,
          p_from_currency: invoice.currency,
          p_to_currency: 'USD',
          p_date: invoice.invoice_date,
        });

        amountInUSD = convertedTotal || invoice.total;
        remainingInUSD = convertedRemaining || remaining;
      }

      // Calculate totals in USD
      if (invoice.status !== 'paid' && invoice.status !== 'void' && invoice.status !== 'cancelled') {
        totalUnpaid += remainingInUSD;

        if (dueDate >= now && dueDate <= weekFromNow) {
          dueThisWeek += remainingInUSD;
        }

        if (dueDate < now) {
          overdue += remainingInUSD;
        }
      }

      if (invoice.status === 'paid' && invoiceDate >= startOfMonth) {
        paidThisMonth += amountInUSD;
      }
    }

    return NextResponse.json({
      totalUnpaid,
      dueThisWeek,
      overdue,
      paidThisMonth,
    });
  } catch (error: any) {
    console.error('Failed to calculate invoice stats:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
