import { NextRequest, NextResponse } from 'next/server';
import { buildRatesMap, convertCurrency } from '@/lib/exchange-rates';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/reports/ar-aging - Accounts Receivable Aging
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const companyRow = await db.query<{ currency: string }>(
      'SELECT currency FROM companies WHERE id = $1',
      [companyId]
    );
    const baseCurrency = companyRow.rows[0]?.currency || 'USD';

    const asOfDate = searchParams.get('as_of_date') || searchParams.get('asOfDate') || new Date().toISOString().split('T')[0];
    const customerId = searchParams.get('customer_id');

    const params: any[] = [companyId, asOfDate];
    const where: string[] = [
      'i.company_id = $1',
      "i.status NOT IN ('paid', 'void', 'cancelled', 'draft')",
      'i.invoice_date <= $2::date',
    ];
    if (customerId) {
      params.push(customerId);
      where.push(`i.customer_id = $${params.length}`);
    }

    const [invoicesResult, ratesResult] = await Promise.all([
      db.query(
        `SELECT i.id,
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                i.total,
                i.amount_paid,
                i.currency,
                i.status,
                c.id AS customer_ref_id,
                c.name AS customer_name,
                c.email AS customer_email
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         WHERE ${where.join(' AND ')}
         ORDER BY i.due_date ASC`,
        params
      ),
      db.query(
        `SELECT from_currency, to_currency, rate, effective_date::text FROM exchange_rates ORDER BY effective_date DESC`
      ),
    ]);

    const invoices = invoicesResult.rows;
    const ratesMap = buildRatesMap(ratesResult.rows, baseCurrency);

    const today = new Date(asOfDate);

    // Initialize aging buckets
    const aging = {
      current: { count: 0, total: 0, invoices: [] as any[] },
      days1to30: { count: 0, total: 0, invoices: [] as any[] },
      days31to60: { count: 0, total: 0, invoices: [] as any[] },
      days61to90: { count: 0, total: 0, invoices: [] as any[] },
      over90: { count: 0, total: 0, invoices: [] as any[] },
    };

    // Customer summaries
    const customerAging: Record<string, {
      customer: any;
      current: number;
      days1to30: number;
      days31to60: number;
      days61to90: number;
      over90: number;
      total: number;
    }> = {};

    for (const invoice of invoices || []) {
      const balance = Number(invoice.total || 0) - Number(invoice.amount_paid || 0);
      if (balance <= 0) continue;

      const fromCurrency = invoice.currency || baseCurrency;
      const balanceBase = convertCurrency(balance, fromCurrency, baseCurrency, ratesMap);

      const dueDate = new Date(invoice.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      const invoiceData = {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        total: invoice.total,
        balance: balanceBase,
        originalBalance: balance,
        currency: fromCurrency,
        days_overdue: Math.max(0, daysOverdue),
        customer: invoice.customer_ref_id
          ? {
              id: invoice.customer_ref_id,
              name: invoice.customer_name,
              email: invoice.customer_email,
            }
          : null,
      };

      let bucket: keyof typeof aging;
      if (daysOverdue <= 0) {
        bucket = 'current';
      } else if (daysOverdue <= 30) {
        bucket = 'days1to30';
      } else if (daysOverdue <= 60) {
        bucket = 'days31to60';
      } else if (daysOverdue <= 90) {
        bucket = 'days61to90';
      } else {
        bucket = 'over90';
      }

      aging[bucket].count++;
      aging[bucket].total += balanceBase;
      aging[bucket].invoices.push(invoiceData);

      const customer: any = invoiceData.customer;
      const custId = customer?.id;
      if (custId) {
        if (!customerAging[custId]) {
          customerAging[custId] = {
            customer: customer,
            current: 0,
            days1to30: 0,
            days31to60: 0,
            days61to90: 0,
            over90: 0,
            total: 0,
          };
        }
        customerAging[custId][bucket] += balanceBase;
        customerAging[custId].total += balanceBase;
      }
    }

    const totalOutstanding =
      aging.current.total +
      aging.days1to30.total +
      aging.days31to60.total +
      aging.days61to90.total +
      aging.over90.total;

    const customers = Object.values(customerAging)
      .sort((a: any, b: any) => b.total - a.total)
      .map((c: any) => ({
        customerId: c.customer?.id || '',
        customerName: c.customer?.name || 'Unknown',
        current: c.current,
        days1to30: c.days1to30,
        days31to60: c.days31to60,
        days61to90: c.days61to90,
        over90: c.over90,
        total: c.total,
      }));

    return NextResponse.json({
      asOfDate,
      currency: baseCurrency,
      summary: {
        totalReceivables: totalOutstanding,
        buckets: [
          { label: 'Current', amount: aging.current.total, count: aging.current.count },
          { label: '1-30 Days', amount: aging.days1to30.total, count: aging.days1to30.count },
          { label: '31-60 Days', amount: aging.days31to60.total, count: aging.days31to60.count },
          { label: '61-90 Days', amount: aging.days61to90.total, count: aging.days61to90.count },
          { label: 'Over 90 Days', amount: aging.over90.total, count: aging.over90.count },
        ],
      },
      customers,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
