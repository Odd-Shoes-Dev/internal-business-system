import { NextRequest, NextResponse } from 'next/server';
import { SupportedCurrency } from '@/lib/currency';
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

    const asOfDate = searchParams.get('as_of_date') || new Date().toISOString().split('T')[0];
    const customerId = searchParams.get('customer_id');

    const params: any[] = [companyId, ['sent', 'partial', 'overdue'], asOfDate];
    const where: string[] = [
      'i.company_id = $1',
      'i.status = ANY($2::text[])',
      'i.invoice_date <= $3::date',
    ];
    if (customerId) {
      params.push(customerId);
      where.push(`i.customer_id = $${params.length}`);
    }

    const invoicesResult = await db.query(
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
    );

    const invoices = invoicesResult.rows;

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

    // Process invoices with currency conversion
    for (const invoice of invoices || []) {
      const balance = Number(invoice.total || 0) - Number(invoice.amount_paid || 0);
      if (balance <= 0) continue;

      let balanceUSD = balance;
      const fromCurrency = (invoice.currency || 'USD') as SupportedCurrency;
      if (fromCurrency !== 'USD') {
        try {
          const conversion = await db.query<{ converted_amount: number }>(
            `SELECT convert_currency($1::numeric, $2::text, $3::text, $4::date) AS converted_amount`,
            [balance, fromCurrency, 'USD', asOfDate]
          );
          balanceUSD = Number(conversion.rows[0]?.converted_amount ?? balance);
        } catch {
          balanceUSD = balance;
        }
      }

      const dueDate = new Date(invoice.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      const invoiceData = {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        total: invoice.total,
        balance: balanceUSD,
        originalBalance: balance,
        currency: invoice.currency || 'USD',
        days_overdue: Math.max(0, daysOverdue),
        customer: invoice.customer_ref_id
          ? {
              id: invoice.customer_ref_id,
              name: invoice.customer_name,
              email: invoice.customer_email,
            }
          : null,
      };

      // Determine bucket
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
      aging[bucket].total += balanceUSD;
      aging[bucket].invoices.push(invoiceData);

      // Update customer summary
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
        customerAging[custId][bucket] += balanceUSD;
        customerAging[custId].total += balanceUSD;
      }
    }

    const totalOutstanding = 
      aging.current.total + 
      aging.days1to30.total + 
      aging.days31to60.total + 
      aging.days61to90.total + 
      aging.over90.total;

    return NextResponse.json({
      data: {
        asOfDate,
        summary: {
          current: aging.current.total,
          days1to30: aging.days1to30.total,
          days31to60: aging.days31to60.total,
          days61to90: aging.days61to90.total,
          over90: aging.over90.total,
          total: totalOutstanding,
        },
        aging,
        byCustomer: Object.values(customerAging).sort((a, b) => b.total - a.total),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

