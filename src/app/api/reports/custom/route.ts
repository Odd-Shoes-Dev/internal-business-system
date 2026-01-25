import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Field {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  table: string;
  displayName: string;
}

interface Filter {
  id: string;
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between' | 'in_range';
  value: string | number | [string | number, string | number];
}

interface Sort {
  fieldId: string;
  direction: 'asc' | 'desc';
}

interface CustomReportConfig {
  name: string;
  description: string;
  dataSource: string;
  selectedFields: string[];
  filters: Filter[];
  sorts: Sort[];
  groupBy?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}


// Fetch real data from database based on data source
const fetchTransactionData = async (config: CustomReportConfig) => {
  const supabase = await createClient();
  
  let query = supabase
    .from('journal_entries')
    .select('id, entry_number, entry_date, description, memo, status')
    .order('entry_date', { ascending: false });

  // Apply date range filter
  if (config.dateRange) {
    query = query
      .gte('entry_date', config.dateRange.startDate)
      .lte('entry_date', config.dateRange.endDate);
  }

  const { data: entries, error } = await query;

  if (error) {
    console.error('Transaction data fetch error:', error);
    throw error;
  }

  // Fetch journal lines to calculate totals
  const { data: lines, error: linesError } = await supabase
    .from('journal_lines')
    .select('journal_entry_id, debit, credit, account_id');

  if (linesError) {
    console.error('Journal lines fetch error:', linesError);
    throw linesError;
  }

  // Transform data to match expected format
  return (entries || []).map(entry => {
    const entryLines = (lines || []).filter(line => line.journal_entry_id === entry.id);
    const totalDebit = entryLines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = entryLines.reduce((sum, line) => sum + (line.credit || 0), 0);
    
    return {
      date: entry.entry_date,
      amount: totalDebit || totalCredit || 0,
      account_name: 'Journal Entry',
      account_type: entry.status || 'N/A',
      description: entry.description || entry.memo || '',
      reference: entry.entry_number || '',
      debit_amount: totalDebit,
      credit_amount: totalCredit,
    };
  });
};

const fetchCustomerData = async (config: CustomReportConfig) => {
  const supabase = await createClient();
  
  // Fetch customers
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('*');

  if (customersError) {
    console.error('Customers fetch error:', customersError);
    throw customersError;
  }

  // Fetch all invoices
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('customer_id, total, amount_paid, invoice_date');

  if (invoicesError) {
    console.error('Invoices fetch error:', invoicesError);
    throw invoicesError;
  }

  // Group invoices by customer and calculate metrics
  return (customers || []).map(customer => {
    const customerInvoices = (invoices || []).filter(inv => inv.customer_id === customer.id);
    const totalSales = customerInvoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
    const invoiceCount = customerInvoices.length;
    
    const sortedInvoices = customerInvoices.sort((a, b) => 
      new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
    );
    
    const firstSale = sortedInvoices.length > 0 ? sortedInvoices[0]?.invoice_date : null;
    const lastSale = sortedInvoices.length > 0 ? sortedInvoices[sortedInvoices.length - 1]?.invoice_date : null;

    return {
      customer_name: customer.name,
      customer_type: customer.company_name ? 'Business' : 'Individual',
      total_sales: totalSales,
      invoice_count: invoiceCount,
      first_sale_date: firstSale,
      last_sale_date: lastSale,
      average_sale: invoiceCount > 0 ? totalSales / invoiceCount : 0,
    };
  });
};

const fetchVendorData = async (config: CustomReportConfig) => {
  const supabase = await createClient();
  
  // Fetch vendors
  const { data: vendors, error: vendorsError } = await supabase
    .from('vendors')
    .select('*');

  if (vendorsError) {
    console.error('Vendors fetch error:', vendorsError);
    throw vendorsError;
  }

  // Fetch all bills
  const { data: bills, error: billsError } = await supabase
    .from('bills')
    .select('vendor_id, total, amount_paid, bill_date');

  if (billsError) {
    console.error('Bills fetch error:', billsError);
    throw billsError;
  }

  // Group bills by vendor and calculate metrics
  return (vendors || []).map(vendor => {
    const vendorBills = (bills || []).filter(bill => bill.vendor_id === vendor.id);
    const totalPurchases = vendorBills.reduce((sum, bill) => sum + (bill.amount_paid || 0), 0);
    const billCount = vendorBills.length;
    
    const sortedBills = vendorBills.sort((a, b) => 
      new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime()
    );
    
    const firstPurchase = sortedBills.length > 0 ? sortedBills[0]?.bill_date : null;
    const lastPurchase = sortedBills.length > 0 ? sortedBills[sortedBills.length - 1]?.bill_date : null;

    return {
      vendor_name: vendor.name,
      vendor_type: vendor.is_1099_vendor ? '1099 Contractor' : 'Supplier',
      total_purchases: totalPurchases,
      bill_count: billCount,
      first_purchase_date: firstPurchase,
      last_purchase_date: lastPurchase,
      average_purchase: billCount > 0 ? totalPurchases / billCount : 0,
    };
  });
};

const fetchInventoryData = async (config: CustomReportConfig) => {
  const supabase = await createClient();
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, sku, name, quantity_on_hand, cost_price, reorder_point, updated_at')
    .eq('track_inventory', true);

  if (error) {
    console.error('Inventory fetch error:', error);
    throw error;
  }

  return (products || []).map(product => ({
    item_name: product.name,
    sku: product.sku || 'N/A',
    quantity_on_hand: product.quantity_on_hand || 0,
    unit_cost: product.cost_price || 0,
    total_value: (product.quantity_on_hand || 0) * (product.cost_price || 0),
    reorder_point: product.reorder_point || 0,
    last_movement_date: product.updated_at,
  }));
};

function applyFiltersAndSorts(data: any[], config: CustomReportConfig) {
  // Apply custom filters
  let filteredData = data.filter(item => {
    return config.filters.every(filter => {
      const fieldValue = item[filter.fieldId];
      const filterValue = filter.value;

      switch (filter.operator) {
        case 'equals':
          return fieldValue == filterValue;
        case 'not_equals':
          return fieldValue != filterValue;
        case 'greater_than':
          return Number(fieldValue) > Number(filterValue);
        case 'less_than':
          return Number(fieldValue) < Number(filterValue);
        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());
        default:
          return true;
      }
    });
  });

  // Apply sorting
  if (config.sorts.length > 0) {
    filteredData.sort((a, b) => {
      for (const sort of config.sorts) {
        const aValue = a[sort.fieldId];
        const bValue = b[sort.fieldId];
        
        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        if (comparison !== 0) {
          return sort.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  return filteredData;
}

export async function POST(request: NextRequest) {
  try {
    console.log('Custom report POST request received');
    const config: CustomReportConfig = await request.json();
    console.log('Config:', JSON.stringify(config, null, 2));
    
    let data: any[] = [];
    
    // Fetch real data from database based on selected data source
    console.log('Fetching data for source:', config.dataSource);
    try {
      switch (config.dataSource) {
        case 'transactions':
          data = await fetchTransactionData(config);
          break;
        case 'customers':
          data = await fetchCustomerData(config);
          break;
        case 'vendors':
          data = await fetchVendorData(config);
          break;
        case 'inventory':
          data = await fetchInventoryData(config);
          break;
        default:
          console.error('Invalid data source:', config.dataSource);
          return NextResponse.json(
            { error: 'Invalid data source: ' + config.dataSource },
            { status: 400 }
          );
      }
      console.log('Data fetched successfully, rows:', data.length);
    } catch (fetchError: any) {
      console.error('Data fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Database error: ' + (fetchError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    // Apply additional filters and sorting
    data = applyFiltersAndSorts(data, config);
    console.log('After filters and sorts, rows:', data.length);

    // Filter data to only include selected fields
    const filteredRows = data.map(row => {
      const filteredRow: any = {};
      config.selectedFields.forEach(fieldId => {
        filteredRow[fieldId] = row[fieldId];
      });
      return filteredRow;
    });

    // Calculate summary statistics
    const summary = {
      totalRows: filteredRows.length,
      generatedAt: new Date().toISOString(),
      filters: config.filters.length,
      sorts: config.sorts.length,
    };

    console.log('Returning response with', filteredRows.length, 'rows');
    return NextResponse.json({
      config,
      summary,
      rows: filteredRows,
    });
  } catch (error: any) {
    console.error('Failed to generate custom report:', error);
    console.error('Error stack:', error?.stack);
    return NextResponse.json(
      { error: 'Failed to generate custom report: ' + (error?.message || 'Unknown error') },
      { status: 500 }
    );
  }
}