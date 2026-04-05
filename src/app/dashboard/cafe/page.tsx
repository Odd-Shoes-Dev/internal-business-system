'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ModuleGuard } from '@/components/module-guard';
import {
  BuildingStorefrontIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  ChartBarIcon,
  UsersIcon,
  PlusIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency } from '@/lib/currency';

interface CafeStats {
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  employeeCount: number;
  totalPayroll: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface ExpenseBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export default function CafeDashboardPage() {
  const { company } = useCompany();
  const [stats, setStats] = useState<CafeStats>({
    revenue: 0,
    expenses: 0,
    profit: 0,
    profitMargin: 0,
    employeeCount: 0,
    totalPayroll: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) {
      return;
    }
    loadCafeData();
  }, [company?.id]);

  const loadCafeData = async () => {
    try {
      setLoading(true);
      if (!company?.id) {
        return;
      }

      const response = await fetch(`/api/cafe/summary?company_id=${company.id}`, {
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load cafe summary');
      }

      setStats(result.stats || {
        revenue: 0,
        expenses: 0,
        profit: 0,
        profitMargin: 0,
        employeeCount: 0,
        totalPayroll: 0,
      });
      setMonthlyData(result.monthlyData || []);
      setExpenseBreakdown(result.expenseBreakdown || []);

    } catch (error) {
      console.error('Error loading cafe data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blueox-primary"></div>
      </div>
    );
  }

  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BuildingStorefrontIcon className="w-8 h-8 text-blueox-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cafe Performance</h1>
            <p className="text-gray-500">Track cafe revenue, expenses, and profitability</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/cafe/record-sales"
            className="btn-primary flex items-center gap-2"
          >
            <ReceiptPercentIcon className="w-5 h-5" />
            Record Sales
          </Link>
          <Link
            href="/dashboard/expenses/new?department=Cafe"
            className="btn-secondary flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Add Expense
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Revenue (This Month)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats.revenue)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Expenses (This Month)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats.expenses)}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <BanknotesIcon className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Profit */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Profit (This Month)</p>
                <p className={`text-2xl font-bold mt-1 ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(stats.profit)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.profitMargin.toFixed(1)}% margin
                </p>
              </div>
              <div className={`p-3 rounded-lg ${stats.profit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                {stats.profit >= 0 ? (
                  <ArrowTrendingUpIcon className="w-6 h-6 text-green-600" />
                ) : (
                  <ArrowTrendingDownIcon className="w-6 h-6 text-red-600" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Employees */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Cafe Staff</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.employeeCount}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Payroll: {formatCurrency(stats.totalPayroll)}/mo
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <UsersIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Revenue Trend (Last 6 Months)</h2>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {monthlyData.map((month, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{month.month}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(month.revenue)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blueox-primary h-2 rounded-full"
                      style={{ width: `${maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Expense Breakdown (This Month)</h2>
          </div>
          <div className="card-body">
            {expenseBreakdown.length > 0 ? (
              <div className="space-y-3">
                {expenseBreakdown.map((item, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {item.category.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(item.amount)}
                        </span>
                        <span className="text-xs text-gray-500">({item.percentage.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No expenses recorded this month</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashboard/cafe/record-sales"
              className="flex items-center gap-3 p-4 border-2 border-green-500 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <BanknotesIcon className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">Record Sales</p>
                <p className="text-xs text-gray-600">Daily/Weekly/Monthly</p>
              </div>
            </Link>

            <Link
              href="/dashboard/employees?department=Cafe"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blueox-primary hover:bg-gray-50 transition-colors"
            >
              <UsersIcon className="w-6 h-6 text-blueox-primary" />
              <div>
                <p className="font-medium text-gray-900">View Cafe Staff</p>
                <p className="text-xs text-gray-500">{stats.employeeCount} employees</p>
              </div>
            </Link>

            <Link
              href="/dashboard/expenses?department=Cafe"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blueox-primary hover:bg-gray-50 transition-colors"
            >
              <BanknotesIcon className="w-6 h-6 text-blueox-primary" />
              <div>
                <p className="font-medium text-gray-900">View Cafe Expenses</p>
                <p className="text-xs text-gray-500">All cafe costs</p>
              </div>
            </Link>

            <Link
              href="/dashboard/reports/profit-loss?accounts=42"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blueox-primary hover:bg-gray-50 transition-colors"
            >
              <ChartBarIcon className="w-6 h-6 text-blueox-primary" />
              <div>
                <p className="font-medium text-gray-900">Cafe P&L Report</p>
                <p className="text-xs text-gray-500">Detailed financials</p>
              </div>
            </Link>

            <Link
              href="/dashboard/general-ledger?account_filter=42"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blueox-primary hover:bg-gray-50 transition-colors"
            >
              <DocumentTextIcon className="w-6 h-6 text-blueox-primary" />
              <div>
                <p className="font-medium text-gray-900">Cafe Transactions</p>
                <p className="text-xs text-gray-500">View all entries</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
