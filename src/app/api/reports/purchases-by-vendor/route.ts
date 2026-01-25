import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { convertCurrency, SupportedCurrency } from '@/lib/currency';

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
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const vendorType = searchParams.get('vendorType') || 'all';
    const sortBy = searchParams.get('sortBy') || 'totalPurchases';
    const minAmount = parseFloat(searchParams.get('minAmount') || '0');

    // Fetch bills with vendor data for the period
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select(`
        id,
        vendor_id,
        bill_date,
        total,
        currency,
        payment_terms,
        vendors (
          id,
          name,
          company_name
        )
      `)
      .gte('bill_date', startDate)
      .lte('bill_date', endDate)
      .neq('status', 'void')
      .order('bill_date');

    if (billsError) {
      console.error('Error fetching bills:', billsError);
      return NextResponse.json({ error: billsError.message }, { status: 500 });
    }

    // Fetch bill lines to get category/account details
    const billIds = (bills || []).map(bill => bill.id);
    let categoryData: any = {};

    if (billIds.length > 0) {
      const { data: lines, error: linesError } = await supabase
        .from('bill_lines')
        .select(`
          bill_id,
          description,
          line_total
        `)
        .in('bill_id', billIds);

      if (linesError) {
        console.error('Error fetching bill lines:', linesError);
      }

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
      if (!bill.vendors) continue;

      const vendorData: any = Array.isArray(bill.vendors) ? bill.vendors[0] : bill.vendors;
      if (!vendorData) continue;

      const vendorId = bill.vendor_id;
      const vendorName = vendorData.company_name || vendorData.name;
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
        supabase,
        total,
        (bill.currency || 'USD') as SupportedCurrency,
        'USD' as SupportedCurrency
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
