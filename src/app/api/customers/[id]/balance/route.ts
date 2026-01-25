import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get all invoices for this customer
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('total, amount_paid, currency, invoice_date, status')
      .eq('customer_id', id);

    if (invoicesError) throw invoicesError;

    let totalOutstanding = 0;

    // Convert each invoice's outstanding balance to USD
    for (const invoice of invoices || []) {
      // Skip paid/void/cancelled invoices
      if (invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'cancelled') continue;

      const total = parseFloat(invoice.total) || 0;
      const paid = parseFloat(invoice.amount_paid) || 0;
      const remaining = total - paid;

      if (remaining <= 0) continue;

      let remainingInUSD = remaining;

      // Convert to USD if not already
      if (invoice.currency && invoice.currency !== 'USD') {
        const { data: converted, error: conversionError } = await supabase.rpc('convert_currency', {
          p_amount: remaining,
          p_from_currency: invoice.currency,
          p_to_currency: 'USD',
          p_date: invoice.invoice_date,
        });

        if (conversionError) {
          console.error('Currency conversion error:', conversionError);
          // Fall back to original amount if conversion fails
          remainingInUSD = remaining;
        } else {
          remainingInUSD = converted || remaining;
        }
      }

      totalOutstanding += remainingInUSD;
    }

    return NextResponse.json({
      outstandingBalance: totalOutstanding,
      currency: 'USD',
    });
  } catch (error) {
    console.error('Error calculating customer balance:', error);
    return NextResponse.json(
      { error: 'Failed to calculate customer balance' },
      { status: 500 }
    );
  }
}
