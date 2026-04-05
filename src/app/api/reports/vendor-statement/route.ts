import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

interface VendorTransaction {
  id: string;
  date: string;
  type: 'Bill' | 'Payment' | 'Credit' | 'Adjustment';
  reference: string;
  description: string;
  amount: number;
  balance: number;
}

interface VendorData {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
}

interface VendorStatementData {
  vendor: VendorData;
  statementPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    beginningBalance: number;
    totalBills: number;
    totalPayments: number;
    totalCredits: number;
    endingBalance: number;
  };
  transactions: VendorTransaction[];
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

    const vendorId = searchParams.get('vendorId');
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    // Fetch vendor data
    const vendorResult = await db.query(
      `SELECT id, name, company_name, email, phone, address_line1, address_line2, city, state, zip_code
       FROM vendors
       WHERE id = $1 AND company_id = $2
       LIMIT 1`,
      [vendorId, companyId]
    );
    const vendor = vendorResult.rows[0];
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Build vendor address
    const addressParts = [
      vendor.address_line1,
      vendor.address_line2,
      [vendor.city, vendor.state, vendor.zip_code].filter(Boolean).join(', ')
    ].filter(Boolean);

    const vendorData: VendorData = {
      id: vendor.id,
      name: vendor.company_name || vendor.name,
      address: addressParts.join(', '),
      phone: vendor.phone,
      email: vendor.email
    };

    // Calculate beginning balance (bills before start date minus payments before start date)
    const beforeBillsResult = await db.query(
      `SELECT total, amount_paid
       FROM bills
       WHERE vendor_id = $1
         AND company_id = $2
         AND bill_date < $3::date`,
      [vendorId, companyId, startDate]
    );
    const beforeBills = beforeBillsResult.rows;

    const beginningBalance = (beforeBills || []).reduce((sum, bill) => 
      sum + (parseFloat(bill.total) - parseFloat(bill.amount_paid || '0')), 0
    );

    // Fetch bills in the period
    const billsResult = await db.query(
      `SELECT id, bill_number, bill_date, due_date, total, amount_paid, status, notes, vendor_invoice_number
       FROM bills
       WHERE vendor_id = $1
         AND company_id = $2
         AND bill_date >= $3::date
         AND bill_date <= $4::date
       ORDER BY bill_date ASC`,
      [vendorId, companyId, startDate, endDate]
    );
    const bills = billsResult.rows;

    // Fetch payments in the period (we'd need a bill_payments table for this)
    // For now, we'll track payments through the amount_paid field on bills
    // In a complete system, you'd have a separate bill_payments table

    // Build transactions list
    const transactions: VendorTransaction[] = [];

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

    // Add bills
    (bills || []).forEach(bill => {
      transactions.push({
        id: bill.id,
        date: bill.bill_date,
        type: 'Bill',
        reference: bill.vendor_invoice_number || bill.bill_number,
        description: bill.notes || 'Bill',
        amount: parseFloat(bill.total),
        balance: 0 // Will be calculated below
      });

      // If there's a payment on this bill, add it as a separate transaction
      const paidAmount = parseFloat(bill.amount_paid || '0');
      if (paidAmount > 0) {
        transactions.push({
          id: `${bill.id}-payment`,
          date: bill.bill_date, // In real system, would have actual payment date
          type: 'Payment',
          reference: `Payment for ${bill.bill_number}`,
          description: 'Payment applied to bill',
          amount: -paidAmount,
          balance: 0 // Will be calculated below
        });
      }
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
    const totalBills = (bills || []).reduce((sum, bill) => sum + parseFloat(bill.total), 0);
    const totalPayments = (bills || []).reduce((sum, bill) => sum + parseFloat(bill.amount_paid || '0'), 0);
    const endingBalance = runningBalance;

    // Calculate aging (for unpaid bills as of end date)
    const unpaidBillsResult = await db.query(
      `SELECT bill_date, due_date, total, amount_paid
       FROM bills
       WHERE vendor_id = $1
         AND company_id = $2
         AND bill_date <= $3::date
         AND status <> 'paid'`,
      [vendorId, companyId, endDate]
    );
    const unpaidBills = unpaidBillsResult.rows;

    const endDateObj = new Date(endDate);
    const aging = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0
    };

    (unpaidBills || []).forEach(bill => {
      const balance = parseFloat(bill.total) - parseFloat(bill.amount_paid || '0');
      if (balance <= 0) return;

      const dueDate = new Date(bill.due_date);
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

    const response: VendorStatementData = {
      vendor: vendorData,
      statementPeriod: {
        startDate,
        endDate
      },
      summary: {
        beginningBalance,
        totalBills,
        totalPayments,
        totalCredits: 0,
        endingBalance
      },
      transactions,
      aging
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Vendor statement report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate vendor statement' },
      { status: 500 }
    );
  }
}

