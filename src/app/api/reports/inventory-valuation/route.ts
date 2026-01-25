import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { convertCurrency, SupportedCurrency } from '@/lib/currency';

interface InventoryItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  location: string;
  quantityOnHand: number;
  unitOfMeasure: string;
  unitCost: number;
  totalValue: number;
  reorderLevel: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

interface InventoryValuationData {
  reportDate: string;
  reportPeriod: {
    asOfDate: string;
  };
  summary: {
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
    totalValueFIFO: number;
    totalValueLIFO: number;
    totalValueAverage: number;
    totalValueStandard: number;
    averageValue: number;
    lowStockItems: number;
    outOfStockItems: number;
    overstockItems: number;
    categories: number;
  };
  items: InventoryItem[];
  categoryBreakdown: Record<string, {
    count: number;
    value: number;
    percentage: number;
  }>;
  locationBreakdown: Record<string, {
    count: number;
    value: number;
  }>;
  valuationMethods: {
    fifo: { totalValue: number; variance: number };
    lifo: { totalValue: number; variance: number };
    average: { totalValue: number; variance: number };
    standard: { totalValue: number; variance: number };
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || 'all';
    const location = searchParams.get('location') || 'all';
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'totalValue';

    // Fetch inventory items from products table
    let query = supabase
      .from('products')
      .select(`
        id,
        sku,
        name,
        quantity_on_hand,
        cost_price,
        currency,
        reorder_point,
        unit_of_measure,
        product_categories (
          name
        )
      `)
      .eq('track_inventory', true)
      .order('id');

    const { data: inventory, error: inventoryError } = await query;

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
      return NextResponse.json({ error: inventoryError.message }, { status: 500 });
    }

    // Transform inventory data and convert to USD
    let items: InventoryItem[] = [];
    
    for (const item of inventory || []) {
      const quantityOnHand = item.quantity_on_hand || 0;
      const unitCost = item.cost_price || 0;
      
      // Convert unit cost to USD if needed
      const unitCostUSD = await convertCurrency(
        supabase,
        unitCost,
        (item.currency || 'USD') as SupportedCurrency,
        'USD' as SupportedCurrency
      ) || unitCost;
      
      const totalValue = quantityOnHand * unitCostUSD;
      const reorderLevel = item.reorder_point || 0;

      // Determine status
      let itemStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
      if (quantityOnHand === 0) {
        itemStatus = 'Out of Stock';
      } else if (quantityOnHand <= reorderLevel) {
        itemStatus = 'Low Stock';
      }

      const category: any = Array.isArray(item.product_categories) ? item.product_categories[0] : item.product_categories;
      
      items.push({
        itemId: item.id,
        itemCode: item.sku || `ITEM-${item.id}`,
        itemName: item.name || 'Unknown Product',
        category: category?.name || 'Uncategorized',
        location: 'Main Warehouse',
        quantityOnHand,
        unitOfMeasure: item.unit_of_measure || 'EA',
        unitCost: unitCostUSD,
        totalValue,
        reorderLevel,
        status: itemStatus,
      });
    }

    // Apply filters
    if (category !== 'all') {
      items = items.filter(item => item.category.toLowerCase() === category.toLowerCase());
    }

    if (location !== 'all') {
      items = items.filter(item => item.location.toLowerCase() === location.toLowerCase());
    }

    if (status !== 'all') {
      if (status === 'low-stock') {
        items = items.filter(item => item.status === 'Low Stock');
      } else if (status === 'out-of-stock') {
        items = items.filter(item => item.status === 'Out of Stock');
      } else if (status === 'in-stock') {
        items = items.filter(item => item.status === 'In Stock');
      }
    }

    // Sort items
    items.sort((a, b) => {
      switch (sortBy) {
        case 'itemName':
          return a.itemName.localeCompare(b.itemName);
        case 'totalValue':
          return b.totalValue - a.totalValue;
        case 'quantityOnHand':
          return b.quantityOnHand - a.quantityOnHand;
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return b.totalValue - a.totalValue;
      }
    });

    // Calculate summary statistics
    const totalValue = items.reduce((sum, item) => sum + item.totalValue, 0);
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantityOnHand, 0);
    const averageValue = totalItems > 0 ? totalValue / totalItems : 0;
    const lowStockItems = items.filter(item => item.status === 'Low Stock').length;
    const outOfStockItems = items.filter(item => item.status === 'Out of Stock').length;

    // Calculate category breakdown
    const categoryBreakdown: Record<string, { count: number; value: number; percentage: number }> = {};
    items.forEach(item => {
      const cat = item.category || 'Uncategorized';
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { count: 0, value: 0, percentage: 0 };
      }
      categoryBreakdown[cat].count += 1;
      categoryBreakdown[cat].value += item.totalValue;
    });

    // Calculate percentages
    Object.values(categoryBreakdown).forEach(cat => {
      cat.percentage = totalValue > 0 ? (cat.value / totalValue) * 100 : 0;
    });

    // Calculate location breakdown
    const locationBreakdown: Record<string, { count: number; value: number }> = {};
    items.forEach(item => {
      const loc = item.location || 'Unknown';
      if (!locationBreakdown[loc]) {
        locationBreakdown[loc] = { count: 0, value: 0 };
      }
      locationBreakdown[loc].count += 1;
      locationBreakdown[loc].value += item.totalValue;
    });

    const categories = Object.keys(categoryBreakdown).length;

    const response: InventoryValuationData = {
      reportDate: new Date().toISOString().split('T')[0],
      reportPeriod: {
        asOfDate: new Date().toISOString().split('T')[0]
      },
      summary: {
        totalItems,
        totalValue,
        totalQuantity,
        totalValueFIFO: totalValue,
        totalValueLIFO: totalValue,
        totalValueAverage: totalValue,
        totalValueStandard: totalValue,
        averageValue,
        lowStockItems,
        outOfStockItems,
        overstockItems: 0,
        categories
      },
      items,
      categoryBreakdown,
      locationBreakdown,
      valuationMethods: {
        fifo: { totalValue, variance: 0 },
        lifo: { totalValue, variance: 0 },
        average: { totalValue, variance: 0 },
        standard: { totalValue, variance: 0 }
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Inventory valuation report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate inventory valuation report' },
      { status: 500 }
    );
  }
}
