import { NextRequest, NextResponse } from 'next/server';
import { convertCurrency, SupportedCurrency } from '@/lib/currency';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

interface VendorPurchase {
  vendorId: string;
  vendorName: string;
  vendorType: string;
  totalPurchases: number;
  purchaseCount: number;
  averagePurchase: number;
  firstPurchaseDate: string;
  lastPurchaseDate: string;
  purchaseGrowth: number;
  paymentTerms: string;
  topCategories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

interface PurchasesByVendorData {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalVendors: number;
    totalPurchases: number;
    averagePurchasePerVendor: number;
    topVendorSpend: number;
    topVendorName: string;
    activeVendors: number;
  };
  vendors: VendorPurchase[];
  topVendors: VendorPurchase[];
  vendorTypes: Record<string, {
    count: number;
    spending: number;
  }>;
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

    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const vendorType = searchParams.get('vendorType') || 'all';
    const sortBy = searchParams.get('sortBy') || 'totalPurchases';
    const minAmount = parseFloat(searchParams.get('minAmount') || '0');

    const billsResult = await db.query(
      `SELECT b.id,
              b.vendor_id,
              b.bill_date,
              b.total,
              b.currency,
              b.payment_terms,
              v.id AS vendor_ref_id,
              v.name AS vendor_name,
              v.company_name AS vendor_company_name
       FROM bills b
       LEFT JOIN vendors v ON v.id = b.vendor_id
       WHERE b.company_id = $1
         AND b.bill_date >= $2::date
         AND b.bill_date <= $3::date
         AND b.status <> 'void'
       ORDER BY b.bill_date ASC`,
      [companyId, startDate, endDate]
    );
    const bills = billsResult.rows;

    // Fetch bill lines to get category/account details
    const billIds = (bills || []).map(bill => bill.id);
    let categoryData: any = {};

    if (billIds.length > 0) {
      const linesResult = await db.query(
        `SELECT bill_id, description, line_total
         FROM bill_lines
         WHERE bill_id = ANY($1::uuid[])`,
        [billIds]
      );
      const lines = linesResult.rows;

      // Group categories by bill
      (lines || []).forEach((line: any) => {
        if (!categoryData[line.bill_id]) {
          categoryData[line.bill_id] = [];
        }
        categoryData[line.bill_id].push({
          name: line.description || 'Expense',
          amount: parseFloat(line.line_total) || 0
        });
      });
    }

    // Group bills by vendor
    const vendorMap = new Map<string, VendorPurchase>();

    for (const bill of bills || []) {
      if (!bill.vendor_ref_id) continue;

      const vendorId = bill.vendor_id;
      const vendorName = bill.vendor_company_name || bill.vendor_name;
      const vendorTypeRaw = 'Supplier'; // Default since vendor_type doesn't exist in vendors table
      const paymentTerms = bill.payment_terms || 30;

      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, {
          vendorId,
          vendorName,
          vendorType: vendorTypeRaw,
          totalPurchases: 0,
          purchaseCount: 0,
          averagePurchase: 0,
          firstPurchaseDate: bill.bill_date,
          lastPurchaseDate: bill.bill_date,
          purchaseGrowth: 0,
          paymentTerms: `Net ${paymentTerms}`,
          topCategories: []
        });
      }

      const vendor = vendorMap.get(vendorId)!;
      
      // Convert total to USD for reporting
      const total = parseFloat(bill.total);
      const totalUSD = await convertCurrency(
        {
          rpc: async (fn: string, args: any) => {
            if (fn !== 'convert_currency') {
              return { data: null, error: new Error('Unsupported RPC function') };
            }
            const result = await db.query<{ value: number }>(
              `SELECT convert_currency($1::numeric, $2::text, $3::text, $4::date) AS value`,
              [args.p_amount, args.p_from_currency, args.p_to_currency, args.p_date]
            );
            return { data: result.rows[0]?.value ?? null, error: null };
          },
        },
        total,
        (bill.currency || 'USD') as SupportedCurrency,
        'USD' as SupportedCurrency,
        endDate
      ) || total;
      
      vendor.totalPurchases += totalUSD;
      vendor.purchaseCount += 1;
      vendor.lastPurchaseDate = bill.bill_date;

      // Update first purchase date if earlier
      if (new Date(bill.bill_date) < new Date(vendor.firstPurchaseDate)) {
        vendor.firstPurchaseDate = bill.bill_date;
      }

      // Aggregate categories for this vendor (already in USD via bill conversion)
      const billCategories = categoryData[bill.id] || [];
      billCategories.forEach((category: any) => {
        const existingCategory = vendor.topCategories.find((c: any) => c.category === category.name);
        if (existingCategory) {
          existingCategory.amount += category.amount;
        } else {
          vendor.topCategories.push({
            category: category.name,
            amount: category.amount,
            percentage: 0 // Will calculate below
          });
        }
      });
    }

    // Calculate averages, percentages, and sort categories for each vendor
    let vendors = Array.from(vendorMap.values());
    vendors.forEach(vendor => {
      vendor.averagePurchase = vendor.purchaseCount > 0 ? vendor.totalPurchases / vendor.purchaseCount : 0;
      
      // Calculate percentages for categories
      vendor.topCategories.forEach((cat: any) => {
        cat.percentage = vendor.totalPurchases > 0 ? (cat.amount / vendor.totalPurchases) * 100 : 0;
      });
      
      // Sort by amount and keep top 5
      vendor.topCategories.sort((a: any, b: any) => b.amount - a.amount);
      vendor.topCategories = vendor.topCategories.slice(0, 5);
    });

    // Filter by vendor type if specified
    if (vendorType !== 'all') {
      vendors = vendors.filter(v => v.vendorType.toLowerCase() === vendorType.toLowerCase());
    }

    // Filter by minimum amount
    if (minAmount > 0) {
      vendors = vendors.filter(v => v.totalPurchases >= minAmount);
    }

    // Sort vendors
    vendors.sort((a, b) => {
      switch (sortBy) {
        case 'vendorName':
          return a.vendorName.localeCompare(b.vendorName);
        case 'totalPurchases':
          return b.totalPurchases - a.totalPurchases;
        case 'purchaseCount':
          return b.purchaseCount - a.purchaseCount;
        default:
          return b.totalPurchases - a.totalPurchases;
      }
    });

    // Calculate summary statistics
    const totalPurchases = vendors.reduce((sum, v) => sum + v.totalPurchases, 0);
    const totalVendors = vendors.length;
    const averagePurchasePerVendor = totalVendors > 0 ? totalPurchases / totalVendors : 0;

    const topVendor = vendors.length > 0 ? vendors[0] : null;

    // Calculate vendor type breakdown
    const vendorTypes: Record<string, { count: number; spending: number }> = {};
    vendors.forEach(vendor => {
      const type = vendor.vendorType || 'Other';
      if (!vendorTypes[type]) {
        vendorTypes[type] = { count: 0, spending: 0 };
      }
      vendorTypes[type].count += 1;
      vendorTypes[type].spending += vendor.totalPurchases;
    });

    // Get top 10 vendors
    const topVendors = vendors.slice(0, 10);

    const response: PurchasesByVendorData = {
      reportPeriod: {
        startDate,
        endDate
      },
      summary: {
        totalVendors,
        totalPurchases,
        averagePurchasePerVendor,
        topVendorSpend: topVendor ? topVendor.totalPurchases : 0,
        topVendorName: topVendor ? topVendor.vendorName : 'N/A',
        activeVendors: totalVendors
      },
      vendors,
      topVendors,
      vendorTypes
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Purchases by vendor report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate purchases by vendor report' },
      { status: 500 }
    );
  }
}

