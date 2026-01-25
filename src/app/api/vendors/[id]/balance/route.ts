import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get all bills for this vendor
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('total, amount_paid, currency, bill_date, status')
      .eq('vendor_id', id);

    if (billsError) throw billsError;

    let totalOutstanding = 0;

    // Convert each bill's outstanding balance to USD
    for (const bill of bills || []) {
      // Skip paid/void bills
      if (bill.status === 'paid' || bill.status === 'void') continue;

      const total = parseFloat(bill.total) || 0;
      const paid = parseFloat(bill.amount_paid) || 0;
      const remaining = total - paid;

      if (remaining <= 0) continue;

      let remainingInUSD = remaining;

      // Convert to USD if not already
      if (bill.currency && bill.currency !== 'USD') {
        const { data: converted, error: conversionError } = await supabase.rpc('convert_currency', {
          p_amount: remaining,
          p_from_currency: bill.currency,
          p_to_currency: 'USD',
          p_date: bill.bill_date,
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
    console.error('Error calculating vendor balance:', error);
    return NextResponse.json(
      { error: 'Failed to calculate vendor balance' },
      { status: 500 }
    );
  }
}
