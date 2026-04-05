import { NextRequest, NextResponse } from 'next/server';
import { convertCurrency, SupportedCurrency } from '@/lib/currency';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

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
    const customerType = searchParams.get('customerType') || 'all';
    const sortBy = searchParams.get('sortBy') || 'totalSales';

    const invoicesResult = await db.query(
      `SELECT i.id,
              i.customer_id,
              i.invoice_date,
              i.total,
              i.currency,
              c.id AS customer_ref_id,
              c.name AS customer_name,
              c.company_name AS customer_company_name,
              c.customer_type
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.company_id = $1
         AND i.invoice_date >= $2::date
         AND i.invoice_date <= $3::date
         AND i.status <> 'void'
       ORDER BY i.invoice_date ASC`,
      [companyId, startDate, endDate]
    );
    const invoices = invoicesResult.rows;

    // Fetch invoice lines to get product details
    const invoiceIds = (invoices || []).map(inv => inv.id);
    let productData: any = {};

    if (invoiceIds.length > 0) {
      const linesResult = await db.query(
        `SELECT il.invoice_id,
                il.product_id,
                il.description,
                il.quantity,
                il.line_total,
                p.name AS product_name
         FROM invoice_lines il
         LEFT JOIN products p ON p.id = il.product_id
         WHERE il.invoice_id = ANY($1::uuid[])`,
        [invoiceIds]
      );
      const lines = linesResult.rows;

      // Group products by invoice
      (lines || []).forEach((line: any) => {
        if (!productData[line.invoice_id]) {
          productData[line.invoice_id] = [];
        }
        productData[line.invoice_id].push({
          name: line.product_name || line.description || 'Product',
          quantity: parseFloat(line.quantity) || 0,
          revenue: parseFloat(line.line_total) || 0
        });
      });
    }

    // Group invoices by customer
    const customerMap = new Map<string, CustomerSale>();

    for (const invoice of invoices || []) {
      if (!invoice.customer_ref_id) continue;

      const customerId = invoice.customer_id;
      const customerName = invoice.customer_company_name || invoice.customer_name;
      const customerTypeRaw = invoice.customer_type || 'Individual';
      
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
        (invoice.currency || 'USD') as SupportedCurrency,
        'USD' as SupportedCurrency,
        endDate
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

