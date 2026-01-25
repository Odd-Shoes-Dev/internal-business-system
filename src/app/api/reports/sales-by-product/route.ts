import { NextRequest, NextResponse } from 'next/server';

interface ProductSale {
  productId: string;
  productName: string;
  category: string;
  unitsSold: number;
  totalRevenue: number;
  averagePrice: number;
  grossMargin: number;
  marginPercentage: number;
  growthRate: number;
  topCustomers: Array<{
    customerName: string;
    quantity: number;
    revenue: number;
  }>;
  salesTrend: Array<{
    month: string;
    sales: number;
  }>;
}

interface CategoryData {
  category: string;
  productCount: number;
  revenue: number;
  unitsSold: number;
  averageMargin: number;
}

interface SalesByProductData {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalProducts: number;
    totalRevenue: number;
    totalUnitsSold: number;
    averageOrderValue: number;
    topProductRevenue: number;
    topProductName: string;
    totalCategories: number;
  };
  products: ProductSale[];
  categories: CategoryData[];
  topPerformers: ProductSale[];
}

// Sample product database
const productDatabase = [
  // Software Products
  { id: 'prod001', name: 'Enterprise CRM Suite', category: 'Software' },
  { id: 'prod002', name: 'Business Intelligence Dashboard', category: 'Software' },
  { id: 'prod003', name: 'Project Management Platform', category: 'Software' },
  { id: 'prod004', name: 'Financial Analytics Tool', category: 'Software' },
  { id: 'prod005', name: 'Customer Portal System', category: 'Software' },
  
  // Consulting Services
  { id: 'cons001', name: 'Digital Transformation Consulting', category: 'Consulting' },
  { id: 'cons002', name: 'Business Process Optimization', category: 'Consulting' },
  { id: 'cons003', name: 'Technology Strategy Assessment', category: 'Consulting' },
  { id: 'cons004', name: 'Data Architecture Design', category: 'Consulting' },
  { id: 'cons005', name: 'Security Audit & Compliance', category: 'Consulting' },
  
  // Support Services
  { id: 'supp001', name: '24/7 Technical Support', category: 'Support' },
  { id: 'supp002', name: 'Premium Support Package', category: 'Support' },
  { id: 'supp003', name: 'Implementation Support', category: 'Support' },
  { id: 'supp004', name: 'System Maintenance Contract', category: 'Support' },
  
  // Training Services
  { id: 'train001', name: 'Administrator Training Course', category: 'Training' },
  { id: 'train002', name: 'End-User Training Workshop', category: 'Training' },
  { id: 'train003', name: 'Advanced Analytics Training', category: 'Training' },
  { id: 'train004', name: 'Custom Training Program', category: 'Training' },
  
  // Hardware Products
  { id: 'hard001', name: 'Enterprise Server Package', category: 'Hardware' },
  { id: 'hard002', name: 'Network Infrastructure Kit', category: 'Hardware' },
  { id: 'hard003', name: 'Security Appliance Bundle', category: 'Hardware' },
  { id: 'hard004', name: 'Workstation Setup Package', category: 'Hardware' }
];

const customerNames = [
  'Acme Corporation', 'Global Industries Ltd.', 'Metro Business Solutions',
  'TechStart Inc.', 'DataFlow Systems', 'City of Boston', 'Massachusetts DOT',
  'Federal Building Services', 'CloudTech Solutions', 'Innovation Labs',
  'Smart Systems Corp', 'Regional Transit Authority', 'NextGen Technologies',
  'Enterprise Solutions Inc.', 'Digital Dynamics LLC'
];

// Generate random product sales data
function generateProductSales(
  product: typeof productDatabase[0],
  startDate: string,
  endDate: string
): ProductSale {
  // Generate base metrics based on product category
  let baseUnits: number;
  let basePrice: number;
  let baseMargin: number;
  
  switch (product.category) {
    case 'Software':
      baseUnits = Math.floor(Math.random() * 150) + 50; // 50-199 units
      basePrice = Math.random() * 8000 + 2000; // $2k-$10k
      baseMargin = Math.random() * 40 + 40; // 40-80%
      break;
    case 'Consulting':
      baseUnits = Math.floor(Math.random() * 30) + 10; // 10-39 projects
      basePrice = Math.random() * 15000 + 5000; // $5k-$20k
      baseMargin = Math.random() * 30 + 50; // 50-80%
      break;
    case 'Support':
      baseUnits = Math.floor(Math.random() * 80) + 20; // 20-99 contracts
      basePrice = Math.random() * 3000 + 500; // $500-$3.5k
      baseMargin = Math.random() * 25 + 35; // 35-60%
      break;
    case 'Training':
      baseUnits = Math.floor(Math.random() * 60) + 15; // 15-74 sessions
      basePrice = Math.random() * 2500 + 750; // $750-$3.25k
      baseMargin = Math.random() * 35 + 45; // 45-80%
      break;
    case 'Hardware':
      baseUnits = Math.floor(Math.random() * 40) + 10; // 10-49 units
      basePrice = Math.random() * 12000 + 3000; // $3k-$15k
      baseMargin = Math.random() * 20 + 15; // 15-35%
      break;
    default:
      baseUnits = 50;
      basePrice = 5000;
      baseMargin = 30;
  }

  const unitsSold = baseUnits;
  const averagePrice = Math.round(basePrice);
  const totalRevenue = unitsSold * averagePrice;
  const marginPercentage = Math.round(baseMargin * 10) / 10;
  const grossMargin = Math.round(totalRevenue * (marginPercentage / 100));

  // Generate growth rate (-50% to +100%)
  const growthRate = Math.round((Math.random() * 150 - 50) * 10) / 10;

  // Generate top customers
  const numCustomers = Math.min(5, Math.floor(Math.random() * 3) + 2);
  const selectedCustomers = [...customerNames]
    .sort(() => Math.random() - 0.5)
    .slice(0, numCustomers);

  const topCustomers = selectedCustomers.map(customerName => {
    const customerUnits = Math.floor(unitsSold / numCustomers * (Math.random() * 0.8 + 0.6));
    return {
      customerName,
      quantity: customerUnits,
      revenue: customerUnits * averagePrice
    };
  });

  // Generate sales trend (last 6 months)
  const salesTrend = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  
  for (let i = 5; i >= 0; i--) {
    const monthIndex = (currentMonth - i + 12) % 12;
    const monthlySales = Math.floor(totalRevenue / 6 * (Math.random() * 0.8 + 0.6));
    salesTrend.push({
      month: monthNames[monthIndex],
      sales: monthlySales
    });
  }

  return {
    productId: product.id,
    productName: product.name,
    category: product.category,
    unitsSold,
    totalRevenue,
    averagePrice,
    grossMargin,
    marginPercentage,
    growthRate,
    topCustomers,
    salesTrend
  };
}

// Sort products based on criteria
function sortProducts(products: ProductSale[], sortBy: string): ProductSale[] {
  return [...products].sort((a, b) => {
    switch (sortBy) {
      case 'productName':
        return a.productName.localeCompare(b.productName);
      case 'totalRevenue':
        return b.totalRevenue - a.totalRevenue;
      case 'unitsSold':
        return b.unitsSold - a.unitsSold;
      case 'averagePrice':
        return b.averagePrice - a.averagePrice;
      case 'marginPercentage':
        return b.marginPercentage - a.marginPercentage;
      case 'growthRate':
        return b.growthRate - a.growthRate;
      default:
        return b.totalRevenue - a.totalRevenue;
    }
  });
}

// Filter products by category
function filterProductsByCategory(products: ProductSale[], category: string): ProductSale[] {
  if (category === 'all') return products;
  return products.filter(product => product.category === category);
}

// Calculate category breakdown
function calculateCategoryBreakdown(products: ProductSale[]): CategoryData[] {
  const categoryMap = new Map<string, {
    products: ProductSale[];
    totalRevenue: number;
    totalUnits: number;
  }>();

  // Group products by category
  products.forEach(product => {
    const category = product.category;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        products: [],
        totalRevenue: 0,
        totalUnits: 0
      });
    }
    
    const categoryData = categoryMap.get(category)!;
    categoryData.products.push(product);
    categoryData.totalRevenue += product.totalRevenue;
    categoryData.totalUnits += product.unitsSold;
  });

  // Convert to CategoryData array
  return Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    productCount: data.products.length,
    revenue: data.totalRevenue,
    unitsSold: data.totalUnits,
    averageMargin: data.products.reduce((sum, p) => sum + p.marginPercentage, 0) / data.products.length
  }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category') || 'all';
    const sortBy = searchParams.get('sortBy') || 'totalRevenue';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Generate sales data for all products
    let products = productDatabase.map(product => 
      generateProductSales(product, startDate, endDate)
    );

    // Filter by category if specified
    products = filterProductsByCategory(products, category);

    // Sort products
    products = sortProducts(products, sortBy);

    // Calculate summary statistics
    const totalProducts = products.length;
    const totalRevenue = products.reduce((sum, product) => sum + product.totalRevenue, 0);
    const totalUnitsSold = products.reduce((sum, product) => sum + product.unitsSold, 0);
    const averageOrderValue = totalUnitsSold > 0 ? totalRevenue / totalUnitsSold : 0;
    
    const topProduct = products.length > 0 ? products[0] : null;
    const topProductRevenue = topProduct ? topProduct.totalRevenue : 0;
    const topProductName = topProduct ? topProduct.productName : 'N/A';

    // Get top 5 performers
    const topPerformers = products.slice(0, 5);

    // Calculate category breakdown
    const categories = calculateCategoryBreakdown(products);
    const totalCategories = categories.length;

    const reportData: SalesByProductData = {
      reportPeriod: {
        startDate,
        endDate
      },
      summary: {
        totalProducts,
        totalRevenue: Math.round(totalRevenue),
        totalUnitsSold,
        averageOrderValue: Math.round(averageOrderValue),
        topProductRevenue,
        topProductName,
        totalCategories
      },
      products,
      categories,
      topPerformers
    };

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating sales by product report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}