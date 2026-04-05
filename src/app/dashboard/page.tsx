'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
  SparklesIcon,
  RocketLaunchIcon,
  EyeIcon,
  FireIcon,
} from '@heroicons/react/24/outline';
import { 
  StatsCardSkeleton,
  ShimmerSkeleton,
} from '@/components/ui/skeleton';

interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  cashBalance: number;
  accountsReceivable: number;
  accountsPayable: number;
  overdueInvoices: number;
  overdueBills: number;
  inventoryValue: number;
}

export default function DashboardPage() {
  const { company, loading: companyLoading } = useCompany();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company) {
      loadDashboardData();
    }
  }, [company]);

  const loadDashboardData = async () => {
    if (!company) return;
    
    try {
      // Get recent invoices
      const invoiceResponse = await fetch(
        `/api/invoices?company_id=${encodeURIComponent(company.id)}&page=1&limit=5`
      );
      const invoicePayload = invoiceResponse.ok ? await invoiceResponse.json() : { data: [] };
      const invoices = invoicePayload?.data || [];

      setRecentInvoices(invoices || []);

      // Get recent bills
      const billResponse = await fetch(
        `/api/bills?company_id=${encodeURIComponent(company.id)}&page=1&limit=5`
      );
      const billPayload = billResponse.ok ? await billResponse.json() : { data: [] };
      const bills = billPayload?.data || [];

      setRecentBills(bills || []);

      // Load stats with currency conversion from API
      const response = await fetch(`/api/dashboard/stats?company_id=${company.id}`);
      if (response.ok) {
        const statsData = await response.json();
        
        // Calculate overdue counts
        const now = new Date();
        const overdueInvoices = (invoices || []).filter((inv: any) => 
          inv.status !== 'paid' && inv.status !== 'void' && 
          inv.status !== 'cancelled' && new Date(inv.due_date) < now
        ).length;

        const overdueBills = (bills || []).filter((bill: any) =>
          bill.status !== 'paid' && bill.status !== 'void' &&
          new Date(bill.due_date) < now
        ).length;

        setStats({
          ...statsData,
          overdueInvoices,
          overdueBills,
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      draft: 'status-draft',
      sent: 'status-sent',
      partial: 'status-partial',
      paid: 'status-paid',
      overdue: 'status-overdue',
      approved: 'status-approved',
      void: 'status-void',
    };
    return classes[status] || 'badge-gray';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Header Skeleton */}
          <div className="relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-10 right-10 w-24 h-24 bg-blueox-primary/5 rounded-full blur-xl"></div>
              <div className="absolute bottom-10 left-1/4 w-32 h-32 bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 rounded-full blur-2xl"></div>
            </div>
            
            <div className="relative bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-3">
                  <ShimmerSkeleton className="w-32 h-8 rounded-full" />
                  <ShimmerSkeleton className="h-10 w-80" />
                  <ShimmerSkeleton className="h-6 w-96" />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <ShimmerSkeleton className="h-12 w-40 rounded-2xl" />
                  <ShimmerSkeleton className="h-12 w-36 rounded-2xl" />
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatsCardSkeleton key={i} />
            ))}
          </div>

          {/* Overview Section Skeleton */}
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <ShimmerSkeleton className="w-5 h-5 rounded-full" />
              <ShimmerSkeleton className="h-6 w-40" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="text-center">
                  <ShimmerSkeleton className="w-12 h-12 rounded-xl mx-auto mb-2" />
                  <ShimmerSkeleton className="h-6 w-20 mx-auto mb-1" />
                  <ShimmerSkeleton className="h-4 w-16 mx-auto" />
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Invoices */}
            <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 px-6 py-4 border-b border-blueox-primary/10">
                <ShimmerSkeleton className="h-6 w-32" />
              </div>
              <div className="p-6 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <ShimmerSkeleton className="w-8 h-8 rounded-lg" />
                      <div>
                        <ShimmerSkeleton className="h-4 w-24 mb-1" />
                        <ShimmerSkeleton className="h-3 w-32" />
                      </div>
                    </div>
                    <div className="text-right">
                      <ShimmerSkeleton className="h-5 w-16 mb-1" />
                      <ShimmerSkeleton className="h-4 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Bills */}
            <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blueox-accent/5 to-blueox-primary/5 px-6 py-4 border-b border-blueox-primary/10">
                <ShimmerSkeleton className="h-6 w-24" />
              </div>
              <div className="p-6 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <ShimmerSkeleton className="w-8 h-8 rounded-lg" />
                      <div>
                        <ShimmerSkeleton className="h-4 w-20 mb-1" />
                        <ShimmerSkeleton className="h-3 w-28" />
                      </div>
                    </div>
                    <div className="text-right">
                      <ShimmerSkeleton className="h-5 w-16 mb-1" />
                      <ShimmerSkeleton className="h-4 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Hero Header Section - More Compact */}
        <div className="relative">
          {/* Floating Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-10 right-10 w-24 h-24 bg-blueox-primary/5 rounded-full blur-xl"></div>
            <div className="absolute bottom-10 left-1/4 w-32 h-32 bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 rounded-full blur-2xl"></div>
          </div>
          
          <div className="relative bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-block">
                  <span className="text-sm font-medium text-blueox-primary bg-white/80 px-3 py-1.5 rounded-full border border-blueox-primary/20 shadow-sm backdrop-blur-sm flex items-center gap-2 w-fit">
                    <SparklesIcon className="w-4 h-4 text-blueox-primary" />
                    Welcome Back
                  </span>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary leading-tight">
                  {company?.name || 'Your Business'}
                </h1>
                <p className="text-lg text-gray-600 font-medium max-w-2xl">
                  Comprehensive overview of your business performance and financial health
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link 
                  href="/dashboard/invoices/new" 
                  className="group bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl text-base font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  <RocketLaunchIcon className="w-4 h-4" />
                  New Invoice
                  <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
                </Link>
                <Link 
                  href="/dashboard/expenses/new" 
                  className="bg-white/80 backdrop-blur-sm hover:bg-white text-blueox-primary border-2 border-blueox-primary/20 hover:border-blueox-primary/40 px-6 py-3 rounded-2xl text-base font-semibold transition-all duration-300 hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <CurrencyDollarIcon className="w-4 h-4" />
                  New Expense
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Stats - Compact Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Cash Balance"
            value={formatCurrency(stats?.cashBalance || 0)}
            icon={BanknotesIcon}
            trend={12.5}
            color="primary"
            size="medium"
            description="Available funds"
          />
          <StatCard
            title="Net Income"
            value={formatCurrency(stats?.netIncome || 0)}
            icon={ArrowTrendingUpIcon}
            trend={8.2}
            color="accent"
            size="medium"
            description="Profit this period"
          />
          <StatCard
            title="Accounts Receivable"
            value={formatCurrency(stats?.accountsReceivable || 0)}
            icon={DocumentTextIcon}
            subtitle={`${stats?.overdueInvoices || 0} overdue`}
            color="secondary"
            size="medium"
          />
          <StatCard
            title="Accounts Payable"
            value={formatCurrency(stats?.accountsPayable || 0)}
            icon={CurrencyDollarIcon}
            subtitle={`${stats?.overdueBills || 0} overdue`}
            color="secondary"
            size="medium"
          />
        </div>

        {/* Quick Overview Stats */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-blueox-primary-dark mb-4 flex items-center gap-2">
            <EyeIcon className="w-5 h-5" />
            Business Overview
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <DocumentTextIcon className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalRevenue || 0)}</p>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <ArrowTrendingUpIcon className="w-3 h-3 text-green-600" />
                <span className="text-xs text-green-600 font-semibold">12.5%</span>
              </div>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalExpenses || 0)}</p>
              <p className="text-sm text-gray-500">Total Expenses</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <ArrowDownIcon className="w-3 h-3 text-red-600" />
                <span className="text-xs text-red-600 font-semibold">3.2%</span>
              </div>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <CubeIcon className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.inventoryValue || 0)}</p>
              <p className="text-sm text-gray-500">Inventory Value</p>
              <p className="text-xs text-gray-400">Current valuation</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <FireIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div className="space-y-1">
                <Link href="/dashboard/reports" className="block text-xs text-blueox-primary hover:text-blueox-primary-hover font-medium transition-colors duration-200">
                  → Reports
                </Link>
                <Link href="/dashboard/settings" className="block text-xs text-blueox-primary hover:text-blueox-primary-hover font-medium transition-colors duration-200">
                  → Settings
                </Link>
                <Link href="/dashboard/customers" className="block text-xs text-blueox-primary hover:text-blueox-primary-hover font-medium transition-colors duration-200">
                  → Customers
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Alert Section - Compact */}
        {((stats?.overdueInvoices || 0) > 0 || (stats?.overdueBills || 0) > 0) && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-yellow-800">Attention Required</h3>
                  <FireIcon className="w-4 h-4 text-yellow-600" />
                </div>
                <p className="text-sm text-yellow-700">
                  <span className="font-semibold">{stats?.overdueInvoices || 0} overdue invoices</span> and{' '}
                  <span className="font-semibold">{stats?.overdueBills || 0} overdue bills</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Link 
                  href="/dashboard/invoices?filter=overdue" 
                  className="inline-flex items-center gap-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 hover:scale-105"
                >
                  <EyeIcon className="w-3 h-3" />
                  Invoices
                </Link>
                <Link 
                  href="/dashboard/bills?filter=overdue" 
                  className="inline-flex items-center gap-1 bg-white hover:bg-gray-50 text-yellow-700 border border-yellow-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 hover:scale-105"
                >
                  <EyeIcon className="w-3 h-3" />
                  Bills
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity - Compact Side by Side Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Invoices */}
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 px-6 py-4 border-b border-blueox-primary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blueox-primary/10 rounded-xl flex items-center justify-center">
                    <DocumentTextIcon className="w-4 h-4 text-blueox-primary" />
                  </div>
                  <h2 className="text-lg font-bold text-blueox-primary-dark">Recent Invoices</h2>
                </div>
                <Link
                  href="/dashboard/invoices"
                  className="text-sm text-blueox-primary hover:text-blueox-primary-hover font-medium transition-colors duration-300 flex items-center gap-1 group"
                >
                  View all
                  <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
                </Link>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <div className="divide-y divide-blueox-primary/10">
                {recentInvoices.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-blueox-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <DocumentTextIcon className="w-6 h-6 text-blueox-primary" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-2">No invoices yet</h3>
                    <Link 
                      href="/dashboard/invoices/new" 
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
                    >
                      <RocketLaunchIcon className="w-3 h-3" />
                      Create invoice
                    </Link>
                  </div>
                ) : (
                  recentInvoices.map((invoice) => (
                    <Link
                      key={invoice.id}
                      href={`/dashboard/invoices/${invoice.id}`}
                      className="block px-6 py-4 hover:bg-blueox-primary/5 transition-all duration-300 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blueox-primary/10 to-blueox-accent/10 rounded-lg flex items-center justify-center">
                            <DocumentTextIcon className="w-4 h-4 text-blueox-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 group-hover:text-blueox-primary transition-colors duration-300">
                              {invoice.invoice_number}
                            </p>
                            <p className="text-sm text-gray-600">
                              {invoice.customers?.name || 'Unknown Customer'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900">
                            {formatCurrency(invoice.total, invoice.currency || 'USD')}
                          </p>
                          <span className={`${getStatusBadge(invoice.status)} px-2 py-1 rounded-full text-xs font-medium`}>
                            {invoice.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent Bills */}
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blueox-accent/5 to-blueox-primary/5 px-6 py-4 border-b border-blueox-primary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blueox-accent/10 rounded-xl flex items-center justify-center">
                    <BanknotesIcon className="w-4 h-4 text-blueox-accent" />
                  </div>
                  <h2 className="text-lg font-bold text-blueox-primary-dark">Recent Bills</h2>
                </div>
                <Link
                  href="/dashboard/bills"
                  className="text-sm text-blueox-primary hover:text-blueox-primary-hover font-medium transition-colors duration-300 flex items-center gap-1 group"
                >
                  View all
                  <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
                </Link>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <div className="divide-y divide-blueox-primary/10">
                {recentBills.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-blueox-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <BanknotesIcon className="w-6 h-6 text-blueox-accent" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-2">No bills yet</h3>
                    <Link 
                      href="/dashboard/bills/new" 
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-accent to-blueox-primary hover:from-blueox-primary-hover hover:to-blueox-accent text-black px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
                    >
                      <CurrencyDollarIcon className="w-3 h-3" />
                      Create bill
                    </Link>
                  </div>
                ) : (
                  recentBills.map((bill) => (
                    <Link
                      key={bill.id}
                      href={`/dashboard/bills/${bill.id}`}
                      className="block px-6 py-4 hover:bg-blueox-accent/5 transition-all duration-300 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blueox-accent/10 to-blueox-primary/10 rounded-lg flex items-center justify-center">
                            <BanknotesIcon className="w-4 h-4 text-blueox-accent" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 group-hover:text-blueox-accent transition-colors duration-300">
                              {bill.bill_number}
                            </p>
                            <p className="text-sm text-gray-600">
                              {bill.vendors?.name || 'Unknown Vendor'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900">
                            {formatCurrency(bill.total, bill.currency || 'USD')}
                          </p>
                          <span className={`${getStatusBadge(bill.status)} px-2 py-1 rounded-full text-xs font-medium`}>
                            {bill.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  color,
  size = 'medium',
  description,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: number;
  subtitle?: string;
  color: 'primary' | 'accent' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  description?: string;
}) {
  const colorClasses = {
    primary: 'from-blueox-primary to-blueox-primary-dark',
    accent: 'from-blueox-accent to-blueox-primary', 
    secondary: 'from-blueox-primary-dark to-blueox-accent',
  };
  
  const sizeClasses = {
    small: 'p-4',
    medium: 'p-6',
    large: 'p-8',
  };
  
  const iconSizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-10 h-10',
    large: 'w-14 h-14',
  };
  
  const titleSizeClasses = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl lg:text-3xl',
  };
  
  const valueSizeClasses = {
    small: 'text-xl',
    medium: 'text-2xl lg:text-3xl',
    large: 'text-3xl lg:text-4xl xl:text-5xl',
  };

  return (
    <div className={`bg-white/90 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl ${sizeClasses[size]} shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group relative overflow-hidden`}>
      {/* Floating background element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blueox-primary/5 to-blueox-accent/5 rounded-full blur-2xl pointer-events-none"></div>
      
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`bg-gradient-to-r ${colorClasses[color]} ${iconSizeClasses[size]} rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
              <Icon className={`${size === 'large' ? 'w-7 h-7' : size === 'medium' ? 'w-5 h-5' : 'w-4 h-4'} text-black`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
              {description && (
                <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">{description}</p>
              )}
            </div>
          </div>
          
          <p className={`${valueSizeClasses[size]} font-bold text-gray-900 leading-tight`}>{value}</p>
          
          {trend !== undefined && (
            <div className="flex items-center gap-2">
              {trend >= 0 ? (
                <ArrowUpIcon className="w-4 h-4 text-green-600" />
              ) : (
                <ArrowDownIcon className="w-4 h-4 text-red-600" />
              )}
              <span
                className={`text-sm font-semibold ${
                  trend >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {Math.abs(trend)}%
              </span>
              <span className="text-sm text-gray-500">vs last month</span>
            </div>
          )}
          
          {subtitle && (
            <p className="text-sm text-gray-500 font-medium">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

