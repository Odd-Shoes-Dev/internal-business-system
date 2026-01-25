import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch all bills with their currencies
    const { data: bills, error } = await supabase
      .from('bills')
      .select('total, amount_paid, due_date, status, currency, bill_date');

    if (error) throw error;

    if (!bills || bills.length === 0) {
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

    for (const bill of bills) {
      const remaining = bill.total - (bill.amount_paid || 0);
      const dueDate = new Date(bill.due_date);
      const billDate = new Date(bill.bill_date);

      // Convert to USD
      let amountInUSD = bill.total;
      let remainingInUSD = remaining;

      if (bill.currency !== 'USD') {
        // Use RPC function to convert
        const { data: convertedTotal } = await supabase.rpc('convert_currency', {
          p_amount: bill.total,
          p_from_currency: bill.currency,
          p_to_currency: 'USD',
          p_date: bill.bill_date,
        });

        const { data: convertedRemaining } = await supabase.rpc('convert_currency', {
          p_amount: remaining,
          p_from_currency: bill.currency,
          p_to_currency: 'USD',
          p_date: bill.bill_date,
        });

        amountInUSD = convertedTotal || bill.total;
        remainingInUSD = convertedRemaining || remaining;
      }

      // Calculate totals in USD
      if (bill.status !== 'paid' && bill.status !== 'void') {
        totalUnpaid += remainingInUSD;

        if (dueDate >= now && dueDate <= weekFromNow) {
          dueThisWeek += remainingInUSD;
        }

        if (dueDate < now) {
          overdue += remainingInUSD;
        }
      }

      if (bill.status === 'paid' && billDate >= startOfMonth) {
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
    console.error('Failed to calculate bill stats:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
