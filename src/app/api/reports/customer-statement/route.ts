import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

interface CustomerTransaction {
  id: string;
  date: string;
  type: 'Invoice' | 'Payment' | 'Credit' | 'Adjustment';
  reference: string;
  description: string;
  amount: number;
  balance: number;
}

interface CustomerData {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
}

interface CustomerStatementData {
  customer: CustomerData;
  statementPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    beginningBalance: number;
    totalInvoiced: number;
    totalPayments: number;
    totalAdjustments: number;
    endingBalance: number;
  };
  transactions: CustomerTransaction[];
  aging: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const searchParams = request.nextUrl.searchParams;

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }
    
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    // Fetch customer data
    const customerResult = await db.query(
      `SELECT id, name, company_name, email, phone, address_line1, address_line2, city, state, zip_code
       FROM customers
       WHERE id = $1 AND company_id = $2
       LIMIT 1`,
      [customerId, companyId]
    );
    const customer = customerResult.rows[0];
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Build customer address
    const addressParts = [
      customer.address_line1,
      customer.address_line2,
      [customer.city, customer.state, customer.zip_code].filter(Boolean).join(', ')
    ].filter(Boolean);

    const customerData: CustomerData = {
      id: customer.id,
      name: customer.company_name || customer.name,
      address: addressParts.join(', '),
      phone: customer.phone,
      email: customer.email
    };

    // Calculate beginning balance (invoices before start date minus payments before start date)
    const beforeInvoicesResult = await db.query(
      `SELECT total, amount_paid
       FROM invoices
       WHERE customer_id = $1
         AND company_id = $2
         AND invoice_date < $3::date`,
      [customerId, companyId, startDate]
    );
    const beforeInvoices = beforeInvoicesResult.rows;

    const beginningBalance = (beforeInvoices || []).reduce((sum, inv) => 
      sum + (parseFloat(inv.total) - parseFloat(inv.amount_paid || '0')), 0
    );

    // Fetch invoices in the period
    const invoicesResult = await db.query(
      `SELECT id, invoice_number, invoice_date, due_date, total, amount_paid, status, notes
       FROM invoices
       WHERE customer_id = $1
         AND company_id = $2
         AND invoice_date >= $3::date
         AND invoice_date <= $4::date
       ORDER BY invoice_date ASC`,
      [customerId, companyId, startDate, endDate]
    );
    const invoices = invoicesResult.rows;

    // Fetch payments in the period
    const paymentsResult = await db.query(
      `SELECT id, payment_number, payment_date, amount, payment_method, reference_number, notes
       FROM payments_received
       WHERE customer_id = $1
         AND company_id = $2
         AND payment_date >= $3::date
         AND payment_date <= $4::date
       ORDER BY payment_date ASC`,
      [customerId, companyId, startDate, endDate]
    );
    const payments = paymentsResult.rows;

    // Build transactions list
    const transactions: CustomerTransaction[] = [];

    // Add beginning balance if non-zero
    if (beginningBalance !== 0) {
      transactions.push({
        id: 'beginning-balance',
        date: startDate,
        type: 'Adjustment',
        reference: 'OPENING',
        description: 'Beginning Balance',
        amount: beginningBalance,
        balance: beginningBalance
      });
    }

    // Add invoices
    (invoices || []).forEach(invoice => {
      transactions.push({
        id: invoice.id,
        date: invoice.invoice_date,
        type: 'Invoice',
        reference: invoice.invoice_number,
        description: invoice.notes || 'Invoice',
        amount: parseFloat(invoice.total),
        balance: 0 // Will be calculated below
      });
    });

    // Add payments
    (payments || []).forEach(payment => {
      transactions.push({
        id: payment.id,
        date: payment.payment_date,
        type: 'Payment',
        reference: payment.payment_number || payment.reference_number || 'Payment',
        description: `Payment via ${payment.payment_method || 'N/A'}${payment.notes ? ' - ' + payment.notes : ''}`,
        amount: -parseFloat(payment.amount),
        balance: 0 // Will be calculated below
      });
    });

    // Sort transactions by date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = 0;
    transactions.forEach(txn => {
      runningBalance += txn.amount;
      txn.balance = runningBalance;
    });

    // Calculate summary
    const totalInvoiced = (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.total), 0);
    const totalPayments = (payments || []).reduce((sum, pmt) => sum + parseFloat(pmt.amount), 0);
    const endingBalance = runningBalance;

    // Calculate aging (for unpaid invoices as of end date)
    const unpaidInvoicesResult = await db.query(
      `SELECT invoice_date, due_date, total, amount_paid
       FROM invoices
       WHERE customer_id = $1
         AND company_id = $2
         AND invoice_date <= $3::date
         AND status <> 'paid'`,
      [customerId, companyId, endDate]
    );
    const unpaidInvoices = unpaidInvoicesResult.rows;

    const endDateObj = new Date(endDate);
    const aging = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0
    };

    (unpaidInvoices || []).forEach(invoice => {
      const balance = parseFloat(invoice.total) - parseFloat(invoice.amount_paid || '0');
      if (balance <= 0) return;

      const dueDate = new Date(invoice.due_date);
      const daysOverdue = Math.floor((endDateObj.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        aging.current += balance;
      } else if (daysOverdue <= 30) {
        aging.days1to30 += balance;
      } else if (daysOverdue <= 60) {
        aging.days31to60 += balance;
      } else if (daysOverdue <= 90) {
        aging.days61to90 += balance;
      } else {
        aging.over90 += balance;
      }
    });

    const response: CustomerStatementData = {
      customer: customerData,
      statementPeriod: {
        startDate,
        endDate
      },
      summary: {
        beginningBalance,
        totalInvoiced,
        totalPayments,
        totalAdjustments: 0,
        endingBalance
      },
      transactions,
      aging
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Customer statement report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate customer statement' },
      { status: 500 }
    );
  }
}

