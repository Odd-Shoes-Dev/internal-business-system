import { NextRequest, NextResponse } from 'next/server';
import { convertCurrency, SupportedCurrency } from '@/lib/currency';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

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

    const category = searchParams.get('category') || 'all';
    const location = searchParams.get('location') || 'all';
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'totalValue';

    const inventoryResult = await db.query(
      `SELECT p.id,
              p.sku,
              p.name,
              p.quantity_on_hand,
              p.cost_price,
              p.currency,
              p.reorder_point,
              p.unit_of_measure,
              pc.name AS category_name
       FROM products p
       LEFT JOIN product_categories pc ON pc.id = p.category_id
       WHERE p.company_id = $1
         AND p.track_inventory = true
       ORDER BY p.id ASC`,
      [companyId]
    );
    const inventory = inventoryResult.rows;

    // Transform inventory data and convert to USD
    let items: InventoryItem[] = [];
    
    for (const item of inventory || []) {
      const quantityOnHand = item.quantity_on_hand || 0;
      const unitCost = item.cost_price || 0;
      
      // Convert unit cost to USD if needed
      const unitCostUSD = await convertCurrency(
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


      items.push({
        itemId: item.id,
        itemCode: item.sku || `ITEM-${item.id}`,
        itemName: item.name || 'Unknown Product',
        category: item.category_name || 'Uncategorized',
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

