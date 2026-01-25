import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    // Multi-tenant: Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Multi-tenant: Get and verify company_id
    const companyId = searchParams.get('company_id');
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Multi-tenant: Verify user has access to this company
    const { data: membership } = await supabase
      .from('user_companies')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
    }
    
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    // Fetch customer data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, company_name, email, phone, address_line1, address_line2, city, state, zip_code')
      .eq('id', customerId)
      .eq('company_id', companyId)
      .single();

    if (customerError || !customer) {
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
    const { data: beforeInvoices } = await supabase
      .from('invoices')
      .select('total, amount_paid')
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      .lt('invoice_date', startDate);

    const beginningBalance = (beforeInvoices || []).reduce((sum, inv) => 
      sum + (parseFloat(inv.total) - parseFloat(inv.amount_paid || '0')), 0
    );

    // Fetch invoices in the period
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, due_date, total, amount_paid, status, notes')
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .order('invoice_date', { ascending: true });

    // Fetch payments in the period
    const { data: payments } = await supabase
      .from('payments_received')
      .select('id, payment_number, payment_date, amount, payment_method, reference_number, notes')
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)
      .order('payment_date', { ascending: true });

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
    const { data: unpaidInvoices } = await supabase
      .from('invoices')
      .select('invoice_date, due_date, total, amount_paid')
      .eq('customer_id', customerId)
      .lte('invoice_date', endDate)
      .neq('status', 'paid');

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
