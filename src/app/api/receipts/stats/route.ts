import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');

    let query = supabase
      .from('invoices')
      .select('total, amount_paid, currency, invoice_date, status, document_type');

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data: receipts, error } = await query.neq('status', 'void');

    if (error) throw error;

    let totalAmount = 0;
    let thisMonthCount = 0;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const receipt of receipts || []) {
      // Only count receipts (document_type === 'receipt')
      if (receipt.document_type !== 'receipt') continue;

      const amountPaid = parseFloat(receipt.amount_paid) || parseFloat(receipt.total) || 0;
      let amountUSD = amountPaid;

      // Convert to USD if not already
      if (receipt.currency && receipt.currency !== 'USD') {
        const { data: converted } = await supabase.rpc('convert_currency', {
          p_amount: amountPaid,
          p_from_currency: receipt.currency,
          p_to_currency: 'USD',
          p_date: receipt.invoice_date,
        });
        amountUSD = converted || amountPaid;
      }

      totalAmount += amountUSD;

      // Count this month receipts
      const receiptDate = new Date(receipt.invoice_date);
      if (receiptDate >= firstDayOfMonth) {
        thisMonthCount++;
      }
    }

    return NextResponse.json({
      totalAmount,
      totalCount: receipts?.filter(r => r.document_type === 'receipt').length || 0,
      thisMonthCount,
    });
  } catch (error) {
    console.error('Error calculating receipts stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate receipts stats' },
      { status: 500 }
    );
  }
}
