// Module definitions and utilities

export interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  setupFee: number;
  monthlyFee: number;
  requiredModules: string[];
  features: string[];
  routes: string[];
  availableForSignup?: boolean; // If false, hidden from registration form
  comingSoon?: boolean; // Show "Coming Soon" badge
}

export const AVAILABLE_MODULES: Record<string, Module> = {
  core: {
    id: 'core',
    name: 'Core Business Platform',
    description: 'Complete business management platform for all businesses',
    icon: 'CalculatorIcon',
    version: '1.0.0',
    setupFee: 0,
    monthlyFee: 0, // Included in base
    requiredModules: [],
    availableForSignup: true,
    features: [
      'Customers & Vendors',
      'Invoices & Receipts',
      'Expenses & Bills',
      'Bank Accounts',
      'Chart of Accounts',
      'Financial Reports',
      'Multi-Currency Support',
      'Employee Directory',
      'Employee Expense Tracking',
    ],
    routes: [
      '/dashboard',
      '/dashboard/customers',
      '/dashboard/vendors',
      '/dashboard/invoices',
      '/dashboard/receipts',
      '/dashboard/expenses',
      '/dashboard/bills',
      '/dashboard/bank',
      '/dashboard/chart-of-accounts',
      '/dashboard/reports',
      '/dashboard/general-ledger',
      '/dashboard/billing',
      '/dashboard/settings',
      '/dashboard/employees',
    ],
  },

  tours: {
    id: 'tours',
    name: 'Tour Operations',
    description: 'Complete tour operator management system',
    icon: 'GlobeAltIcon',
    version: '1.0.0',
    setupFee: 200,
    monthlyFee: 50,
    requiredModules: ['core'],
    availableForSignup: true, // ✅ AVAILABLE FOR DEMO
    features: [
      'Tour Packages & Itineraries',
      'Booking System',
      'Capacity Tracking',
      'Seasonal Pricing',
      'Guide Management',
      'Tour Profitability Reports',
    ],
    routes: [
      '/dashboard/bookings',
      '/dashboard/tours',
      '/dashboard/destinations',
    ],
  },

  fleet: {
    id: 'fleet',
    name: 'Fleet Management',
    description: 'Vehicle fleet tracking and maintenance',
    icon: 'TruckIcon',
    version: '1.0.0',
    setupFee: 100,
    monthlyFee: 30,
    requiredModules: ['core'],
    availableForSignup: true, // ✅ AVAILABLE
    comingSoon: false,
    features: [
      'Vehicle Registry',
      'Maintenance Tracking',
      'Fuel Management',
      'Driver Assignment',
      'Utilization Reports',
    ],
    routes: ['/dashboard/fleet'],
  },

  hotels: {
    id: 'hotels',
    name: 'Hotel Management',
    description: 'Hotel directory and reservations',
    icon: 'HomeIcon',
    version: '1.0.0',
    setupFee: 100,
    monthlyFee: 30,
    requiredModules: ['core'],
    availableForSignup: true, // ✅ AVAILABLE
    comingSoon: false,
    features: [
      'Hotel Directory',
      'Room Types & Pricing',
      'Reservations',
      'Occupancy Tracking',
    ],
    routes: ['/dashboard/hotels'],
  },

  cafe: {
    id: 'cafe',
    name: 'Cafe & Restaurant POS',
    description: 'Point of sale and sales tracking for cafes and restaurants',
    icon: 'CakeIcon',
    version: '1.0.0',
    setupFee: 150,
    monthlyFee: 49,
    requiredModules: ['core', 'inventory'],
    availableForSignup: true, // ✅ AVAILABLE
    features: [
      'Sales Recording & Tracking',
      'Daily/Monthly Revenue Reports',
      'Expense Breakdown',
      'Food & Beverage Sales',
      'Catering Revenue Tracking',
      'Profit Margin Analysis',
    ],
    routes: [
      '/dashboard/cafe',
      '/dashboard/cafe/record-sales',
    ],
  },

  retail: {
    id: 'retail',
    name: 'Retail & Shop Management',
    description: 'Advanced inventory and point-of-sale for retail businesses',
    icon: 'ShoppingBagIcon',
    version: '1.0.0',
    setupFee: 150,
    monthlyFee: 35,
    requiredModules: ['core', 'inventory'],
    availableForSignup: false, // ❌ DISABLED FOR DEMO
    comingSoon: true,
    features: [
      'Product Catalog Management',
      'Sales Orders',
      'Price Tiers & Discounts',
      'Barcode Scanning',
      'POS Integration',
    ],
    routes: ['/dashboard/retail'],
  },

  security: {
    id: 'security',
    name: 'Security Operations',
    description: 'Guard scheduling and site management',
    icon: 'ShieldCheckIcon',
    version: '1.0.0',
    setupFee: 200,
    monthlyFee: 50,
    requiredModules: ['core', 'employees'],
    availableForSignup: false, // ❌ DISABLED FOR DEMO
    comingSoon: true,
    features: [
      'Guard Scheduling',
      'Site Management',
      'Patrol Tracking',
      'Incident Reports',
      'Client Billing',
    ],
    routes: ['/dashboard/security'],
  },

  inventory: {
    id: 'inventory',
    name: 'Inventory & Assets',
    description: 'Full inventory management with multi-location support and asset tracking',
    icon: 'CubeIcon',
    version: '1.0.0',
    setupFee: 100,
    monthlyFee: 39,
    requiredModules: ['core'],
    availableForSignup: true,
    features: [
      'Product Inventory',
      'Stock Tracking & Adjustments',
      'FIFO Valuation',
      'Low Stock Alerts',
      'Fixed Assets Management',
      'Depreciation Tracking',
      'Purchase Orders',
      'Multi-location Support',
    ],
    routes: [
      '/dashboard/inventory', 
      '/dashboard/goods-receipts',
      '/dashboard/assets',
      '/dashboard/purchase-orders',
    ],
  },

  payroll: {
    id: 'payroll',
    name: 'Payroll Processing',
    description: 'Automated payroll processing with tax compliance and payslip generation',
    icon: 'CalculatorIcon',
    version: '1.0.0',
    setupFee: 100,
    monthlyFee: 35,
    requiredModules: ['core'],
    availableForSignup: true,
    features: [
      'Automated Payroll Processing',
      'Payslip Generation & Distribution',
      'Tax Calculations (PAYE, NSSF)',
      'Salary Advances & Loans',
      'Deductions Management',
      'Bank Payment Files',
      'Payroll Compliance Reports',
    ],
    routes: [
      '/dashboard/payroll',
    ],
  },
};

/**
 * Get module by ID
 */
export function getModule(moduleId: string): Module | undefined {
  return AVAILABLE_MODULES[moduleId];
}

/**
 * Get only modules available for signup (filters out disabled modules)
 */
export function getAvailableModules(): Module[] {
  return Object.values(AVAILABLE_MODULES).filter(
    module => module.availableForSignup !== false && module.id !== 'core'
  );
}

/**
 * Get all modules including disabled ones (for admin purposes)
 */
export function getAllModules(): Module[] {
  return Object.values(AVAILABLE_MODULES);
}

/**
 * Check if user has access to a route based on enabled modules
 */
export function hasRouteAccess(route: string, enabledModules: string[]): boolean {
  // Core routes are always accessible
  const coreModule = AVAILABLE_MODULES.core;
  if (coreModule.routes.some(r => route.startsWith(r))) {
    return true;
  }

  // Check if route belongs to any enabled module
  for (const moduleId of enabledModules) {
    const module = AVAILABLE_MODULES[moduleId];
    if (module && module.routes.some(r => route.startsWith(r))) {
      return true;
    }
  }

  return false;
}

/**
 * Get all routes user can access
 */
export function getAccessibleRoutes(enabledModules: string[]): string[] {
  const routes = [...AVAILABLE_MODULES.core.routes];

  for (const moduleId of enabledModules) {
    const module = AVAILABLE_MODULES[moduleId];
    if (module) {
      routes.push(...module.routes);
    }
  }

  return [...new Set(routes)]; // Remove duplicates
}

/**
 * Calculate total monthly cost
 */
export function calculateMonthlyCost(enabledModules: string[]): number {
  let total = AVAILABLE_MODULES.core.monthlyFee;

  for (const moduleId of enabledModules) {
    const module = AVAILABLE_MODULES[moduleId];
    if (module) {
      total += module.monthlyFee;
    }
  }

  return total;
}
