'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChartBarIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ScaleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { ShimmerSkeleton } from '@/components/ui/skeleton';

interface ReportCard {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

const reports: ReportCard[] = [
  // Financial Statements
  {
    title: 'Profit & Loss',
    description: 'Income statement showing revenues, costs, and expenses',
    href: '/dashboard/reports/profit-loss',
    icon: CurrencyDollarIcon,
    category: 'Financial Statements',
  },
  {
    title: 'Balance Sheet',
    description: 'Assets, liabilities, and equity at a point in time',
    href: '/dashboard/reports/balance-sheet',
    icon: ScaleIcon,
    category: 'Financial Statements',
  },
  {
    title: 'Cash Flow Statement',
    description: 'Cash inflows and outflows from operations, investing, and financing',
    href: '/dashboard/reports/cash-flow',
    icon: ArrowTrendingUpIcon,
    category: 'Financial Statements',
  },
  {
    title: 'Trial Balance',
    description: 'List of all account balances to verify debits equal credits',
    href: '/dashboard/reports/trial-balance',
    icon: DocumentTextIcon,
    category: 'Financial Statements',
  },
  // Receivables
  {
    title: 'Accounts Receivable Aging',
    description: 'Outstanding customer invoices by age',
    href: '/dashboard/reports/ar-aging',
    icon: ClockIcon,
    category: 'Receivables',
  },
  {
    title: 'Customer Statement',
    description: 'Transaction history and balance for a customer',
    href: '/dashboard/reports/customer-statement',
    icon: DocumentTextIcon,
    category: 'Receivables',
  },
  {
    title: 'Sales by Customer',
    description: 'Revenue breakdown by customer',
    href: '/dashboard/reports/sales-by-customer',
    icon: ChartBarIcon,
    category: 'Receivables',
  },
  {
    title: 'Sales by Product',
    description: 'Revenue breakdown by product/service',
    href: '/dashboard/reports/sales-by-product',
    icon: ChartBarIcon,
    category: 'Receivables',
  },
  // Payables
  {
    title: 'Accounts Payable Aging',
    description: 'Outstanding vendor bills by age',
    href: '/dashboard/reports/ap-aging',
    icon: ClockIcon,
    category: 'Payables',
  },
  {
    title: 'Vendor Statement',
    description: 'Transaction history and balance for a vendor',
    href: '/dashboard/reports/vendor-statement',
    icon: DocumentTextIcon,
    category: 'Payables',
  },
  {
    title: 'Purchases by Vendor',
    description: 'Expense breakdown by vendor',
    href: '/dashboard/reports/purchases-by-vendor',
    icon: ChartBarIcon,
    category: 'Payables',
  },
  // Other
  {
    title: 'General Ledger',
    description: 'Complete transaction history by account',
    href: '/dashboard/reports/general-ledger',
    icon: DocumentTextIcon,
    category: 'Accounting',
  },
  {
    title: 'Journal Entries',
    description: 'All journal entries with details',
    href: '/dashboard/reports/journal-entries',
    icon: DocumentTextIcon,
    category: 'Accounting',
  },
  {
    title: 'Asset Depreciation Schedule',
    description: 'Fixed asset depreciation over time',
    href: '/dashboard/reports/depreciation',
    icon: CalendarIcon,
    category: 'Assets',
  },
  {
    title: 'Inventory Valuation',
    description: 'Current stock value by item',
    href: '/dashboard/reports/inventory-valuation',
    icon: ChartBarIcon,
    category: 'Inventory',
  },
  {
    title: 'Tax Summary',
    description: 'Sales tax collected and payable',
    href: '/dashboard/reports/tax-summary',
    icon: CurrencyDollarIcon,
    category: 'Tax',
  },
];

export default function ReportsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const categories = ['all', ...Array.from(new Set(reports.map((r) => r.category)))];
  const filteredReports = selectedCategory === 'all' 
    ? reports 
    : reports.filter((r) => r.category === selectedCategory);

  // Group reports by category
  const groupedReports = filteredReports.reduce((acc, report) => {
    if (!acc[report.category]) {
      acc[report.category] = [];
    }
    acc[report.category].push(report);
    return acc;
  }, {} as Record<string, ReportCard[]>);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto py-8 px-6 space-y-8">
          {/* Header Skeleton */}
          <div>
            <ShimmerSkeleton className="h-8 w-40 mb-2" />
            <ShimmerSkeleton className="h-4 w-64" />
          </div>

          {/* Filter Skeleton */}
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <ShimmerSkeleton key={i} className="h-9 w-28 rounded-xl" />
              ))}
            </div>
          </div>

          {/* Reports Grid Skeleton */}
          {[1, 2].map((section) => (
            <div key={section}>
              <ShimmerSkeleton className="h-6 w-48 mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
                    <div className="flex items-start gap-4">
                      <ShimmerSkeleton className="w-12 h-12 rounded-xl" />
                      <div className="flex-1">
                        <ShimmerSkeleton className="h-5 w-32 mb-2" />
                        <ShimmerSkeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
        <div className="absolute top-60 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
        <div className="absolute bottom-40 left-1/3 w-20 h-20 bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 rounded-full blur-xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto py-8 px-6 space-y-8">
        {/* Header */}
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-3 bg-white/70 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl px-6 py-3 shadow-lg mb-6">
            <ChartBarIcon className="w-6 h-6 text-blueox-primary" />
            <span className="text-blueox-primary font-semibold">Financial Reports</span>
          </div>
          
          <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
            Reports & Analytics
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            Generate and view comprehensive financial reports and business insights
          </p>
        </div>

        {/* Category Filter */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category
                    ? 'bg-blueox-primary text-black shadow-lg'
                    : 'bg-white/80 text-black hover:bg-blueox-primary/10 border border-blueox-primary/20'
                }`}
              >
                {category === 'all' ? 'All Reports' : category}
              </button>
            ))}
          </div>
        </div>

        {/* Reports Grid */}
        {Object.entries(groupedReports).map(([category, categoryReports]) => (
          <div key={category}>
            <h2 className="text-xl font-bold text-blueox-primary-dark mb-4">{category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryReports.map((report) => (
                <Link
                  key={report.href}
                  href={report.href}
                  className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl hover:shadow-2xl hover:border-blueox-primary/40 transition-all duration-300 group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blueox-primary/10 rounded-xl flex-shrink-0 group-hover:bg-blueox-primary/20 transition-colors duration-300">
                      <report.icon className="w-6 h-6 text-blueox-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-blueox-primary-dark group-hover:text-blueox-primary transition-colors duration-300">{report.title}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{report.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Custom Report Builder */}
        <div className="bg-gradient-to-br from-purple-100/80 via-pink-100/80 to-blue-100/80 backdrop-blur-xl border border-purple-300/30 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-blueox-primary-dark">Custom Report Builder</h3>
              <p className="text-sm text-gray-700 mt-1">
                Create custom reports with your own filters, date ranges, and groupings
              </p>
            </div>
            <Link 
              href="/dashboard/reports/custom" 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105 whitespace-nowrap"
            >
              Build Custom Report
            </Link>
          </div>
        </div>

        {/* Scheduled Reports */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-blueox-primary/10 flex justify-between items-center">
            <h2 className="text-lg font-bold text-blueox-primary-dark">Scheduled Reports</h2>
            <Link href="/dashboard/reports/scheduled" className="text-sm text-blueox-primary font-semibold hover:text-blueox-primary-dark transition-colors duration-200">
              Manage Schedules
            </Link>
          </div>
          <div className="p-6">
            <div className="text-center py-8 text-gray-500">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blueox-primary/10 rounded-full mb-4">
                <CalendarIcon className="w-8 h-8 text-blueox-primary" />
              </div>
              <p className="text-base font-medium text-gray-700 mb-1">No scheduled reports</p>
              <p className="text-sm text-gray-600 mb-6">Set up automatic report delivery to your email</p>
              <Link 
                href="/dashboard/reports/scheduled/new" 
                className="inline-flex items-center gap-2 bg-white/80 hover:bg-white/90 text-blueox-primary backdrop-blur-xl border border-blueox-primary/20 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
              >
                Schedule a Report
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

