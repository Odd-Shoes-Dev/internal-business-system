import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { convertCurrency, SupportedCurrency } from '@/lib/currency';

interface CustomerSale {
  customerId: string;
  customerName: string;
  customerType: 'Individual' | 'Business' | 'Government';
  totalSales: number;
  invoiceCount: number;
  averageSale: number;
  firstSaleDate: string;
  lastSaleDate: string;
  salesGrowth: number;
  topProducts: Array<{
    product: string;
    quantity: number;
    revenue: number;
  }>;
}

interface SalesByCustomerData {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalCustomers: number;
    totalSales: number;
    averageSalePerCustomer: number;
    topCustomerRevenue: number;
    topCustomerName: string;
    newCustomers: number;
    returningCustomers: number;
  };
  customers: CustomerSale[];
  topCustomers: CustomerSale[];
  customerTypes: {
    individual: { count: number; revenue: number };
    business: { count: number; revenue: number };
    government: { count: number; revenue: number };
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const customerType = searchParams.get('customerType') || 'all';
    const sortBy = searchParams.get('sortBy') || 'totalSales';

    // Fetch invoices with customer data for the period
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        id,
        customer_id,
        invoice_date,
        total,
        currency,
        customers (
          id,
          name,
          company_name,
          customer_type
        )
      `)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .neq('status', 'void')
      .order('invoice_date');

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      return NextResponse.json({ error: invoicesError.message }, { status: 500 });
    }

    // Fetch invoice lines to get product details
    const invoiceIds = (invoices || []).map(inv => inv.id);
    let productData: any = {};

    if (invoiceIds.length > 0) {
      const { data: lines } = await supabase
        .from('invoice_lines')
        .select(`
          invoice_id,
          product_id,
          description,
          quantity,
          line_total,
          products (
            name
          )
        `)
        .in('invoice_id', invoiceIds);

      // Group products by invoice
      (lines || []).forEach((line: any) => {
        if (!productData[line.invoice_id]) {
          productData[line.invoice_id] = [];
        }
        productData[line.invoice_id].push({
          name: line.products?.name || line.description || 'Product',
          quantity: parseFloat(line.quantity) || 0,
          revenue: parseFloat(line.line_total) || 0
        });
      });
    }

    // Group invoices by customer
    const customerMap = new Map<string, CustomerSale>();

    for (const invoice of invoices || []) {
      if (!invoice.customers) continue;

      const customerData: any = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers;
      if (!customerData) continue;

      const customerId = invoice.customer_id;
      const customerName = customerData.company_name || customerData.name;
      const customerTypeRaw = customerData.customer_type || 'Individual';
      
      // Map customer type to expected format
      let customerType: 'Individual' | 'Business' | 'Government' = 'Individual';
      if (customerTypeRaw.toLowerCase().includes('business') || customerTypeRaw.toLowerCase().includes('company')) {
        customerType = 'Business';
      } else if (customerTypeRaw.toLowerCase().includes('government') || customerTypeRaw.toLowerCase().includes('govt')) {
        customerType = 'Government';
      }

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          customerName,
          customerType,
          totalSales: 0,
          invoiceCount: 0,
          averageSale: 0,
          firstSaleDate: invoice.invoice_date,
          lastSaleDate: invoice.invoice_date,
          salesGrowth: 0,
          topProducts: []
        });
      }

      const customer = customerMap.get(customerId)!;
      
      // Convert total to USD for reporting
      const total = parseFloat(invoice.total);
      const totalUSD = await convertCurrency(
        supabase,
        total,
        (invoice.currency || 'USD') as SupportedCurrency,
        'USD' as SupportedCurrency
      ) || total;
      
      customer.totalSales += totalUSD;
      customer.invoiceCount += 1;
      customer.lastSaleDate = invoice.invoice_date;

      // Update first sale date if earlier
      if (new Date(invoice.invoice_date) < new Date(customer.firstSaleDate)) {
        customer.firstSaleDate = invoice.invoice_date;
      }

      // Aggregate products for this customer
      const invoiceProducts = productData[invoice.id] || [];
      invoiceProducts.forEach((product: any) => {
        const existingProduct = customer.topProducts.find((p: any) => p.product === product.name);
        if (existingProduct) {
          existingProduct.quantity += product.quantity;
          existingProduct.revenue += product.revenue;
        } else {
          customer.topProducts.push({
            product: product.name,
            quantity: product.quantity,
            revenue: product.revenue
          });
        }
      });
    }

    // Calculate average sales and sort top products for each customer
    let customers = Array.from(customerMap.values());
    customers.forEach(customer => {
      customer.averageSale = customer.invoiceCount > 0 ? customer.totalSales / customer.invoiceCount : 0;
      customer.topProducts.sort((a: any, b: any) => b.revenue - a.revenue);
      customer.topProducts = customer.topProducts.slice(0, 5); // Keep top 5 products
    });

    // Filter by customer type if specified
    if (customerType !== 'all') {
      customers = customers.filter(c => c.customerType === customerType);
    }

    // Sort customers
    customers.sort((a, b) => {
      switch (sortBy) {
        case 'customerName':
          return a.customerName.localeCompare(b.customerName);
        case 'totalSales':
          return b.totalSales - a.totalSales;
        case 'invoiceCount':
          return b.invoiceCount - a.invoiceCount;
        default:
          return b.totalSales - a.totalSales;
      }
    });

    // Calculate summary statistics
    const totalSales = customers.reduce((sum, c) => sum + c.totalSales, 0);
    const totalCustomers = customers.length;
    const averageSalePerCustomer = totalCustomers > 0 ? totalSales / totalCustomers : 0;

    const topCustomer = customers.length > 0 ? customers[0] : null;

    // Calculate customer type breakdown
    const customerTypes = {
      individual: {
        count: customers.filter(c => c.customerType === 'Individual').length,
        revenue: customers.filter(c => c.customerType === 'Individual').reduce((sum, c) => sum + c.totalSales, 0)
      },
      business: {
        count: customers.filter(c => c.customerType === 'Business').length,
        revenue: customers.filter(c => c.customerType === 'Business').reduce((sum, c) => sum + c.totalSales, 0)
      },
      government: {
        count: customers.filter(c => c.customerType === 'Government').length,
        revenue: customers.filter(c => c.customerType === 'Government').reduce((sum, c) => sum + c.totalSales, 0)
      }
    };

    // Get top 10 customers
    const topCustomers = customers.slice(0, 10);

    const response: SalesByCustomerData = {
      reportPeriod: {
        startDate,
        endDate
      },
      summary: {
        totalCustomers,
        totalSales,
        averageSalePerCustomer,
        topCustomerRevenue: topCustomer ? topCustomer.totalSales : 0,
        topCustomerName: topCustomer ? topCustomer.customerName : 'N/A',
        newCustomers: 0, // Would need to track customer creation date
        returningCustomers: totalCustomers
      },
      customers,
      topCustomers,
      customerTypes
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Sales by customer report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate sales by customer report' },
      { status: 500 }
    );
  }
}
