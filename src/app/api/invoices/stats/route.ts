import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';
import { buildRatesMap, convertCurrency } from '@/lib/exchange-rates';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const userCompany = await db.query<{ company_id: string }>(
      `SELECT company_id
       FROM user_companies
       WHERE user_id = $1
       ORDER BY is_primary DESC, joined_at ASC
       LIMIT 1`,
      [user.id]
    );

    if (!userCompany.rowCount) {
      return NextResponse.json({ error: 'No company found for user' }, { status: 403 });
    }

    const companyId = userCompany.rows[0].company_id;

    const companyResult = await db.query<{ currency: string }>(
      'SELECT currency FROM companies WHERE id = $1 LIMIT 1',
      [companyId]
    );
    const baseCurrency = companyResult.rows[0]?.currency || 'USD';

    const ratesResult = await db.query<{ from_currency: string; to_currency: string; rate: number }>(
      `SELECT DISTINCT ON (from_currency, to_currency) from_currency, to_currency, rate
       FROM exchange_rates
       ORDER BY from_currency, to_currency, effective_date DESC`
    );
    const ratesMap = buildRatesMap(ratesResult.rows, baseCurrency);

    const invoices = await db.query<{
      total: number;
      amount_paid: number;
      due_date: string;
      status: string;
      currency: string;
      invoice_date: string;
    }>(
      `SELECT total, amount_paid, due_date, status, currency, invoice_date
       FROM invoices
       WHERE company_id = $1`,
      [companyId]
    );

    if (!invoices.rows || invoices.rows.length === 0) {
      return NextResponse.json({
        totalUnpaid: 0,
        dueThisWeek: 0,
        overdue: 0,
        paidThisMonth: 0,
        currency: baseCurrency,
      });
    }

    const now = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalUnpaid = 0;
    let dueThisWeek = 0;
    let overdue = 0;
    let paidThisMonth = 0;

    for (const invoice of invoices.rows) {
      const invoiceCurrency = invoice.currency || baseCurrency;
      const total = Number(invoice.total || 0);
      const amountPaid = Number(invoice.amount_paid || 0);
      const remaining = total - amountPaid;

      const totalInBase = convertCurrency(total, invoiceCurrency, baseCurrency, ratesMap);
      const remainingInBase = convertCurrency(remaining, invoiceCurrency, baseCurrency, ratesMap);

      const dueDate = new Date(invoice.due_date);
      const invoiceDate = new Date(invoice.invoice_date);

      if (invoice.status !== 'paid' && invoice.status !== 'void' && invoice.status !== 'cancelled') {
        totalUnpaid += remainingInBase;

        if (dueDate >= now && dueDate <= weekFromNow) {
          dueThisWeek += remainingInBase;
        }

        if (dueDate < now) {
          overdue += remainingInBase;
        }
      }

      if (invoice.status === 'paid' && invoiceDate >= startOfMonth) {
        paidThisMonth += totalInBase;
      }
    }

    return NextResponse.json({
      totalUnpaid,
      dueThisWeek,
      overdue,
      paidThisMonth,
      currency: baseCurrency,
    });
  } catch (error: any) {
    console.error('Failed to calculate invoice stats:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
