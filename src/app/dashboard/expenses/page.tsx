'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ReceiptPercentIcon,
  EyeIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { Expense } from '@/types/database';

type ExpenseStatus = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';

interface ExpenseWithDetails extends Expense {
  vendors?: { name: string } | null;
  accounts?: { name: string; code: string } | null;
}

export default function ExpensesPage() {
  const { company } = useCompany();
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>(searchParams.get('department') || 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    thisMonth: 0,
    pendingApproval: 0,
    approved: 0,
    paid: 0,
  });
  const pageSize = 20;

  useEffect(() => {
    if (company) {
      loadExpenses();
      loadStats();
    }
  }, [company, searchQuery, statusFilter, departmentFilter, currentPage]);

  const loadExpenses = async () => {
    if (!company) return;
    
    try {
      setLoading(true);

      const params = new URLSearchParams({
        company_id: company.id,
        page: String(currentPage),
        limit: String(pageSize),
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      if (departmentFilter && departmentFilter !== 'all') {
        params.append('department', departmentFilter);
      }

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/expenses?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load expenses');
      }

      const result = await response.json();
      setExpenses(result.data || []);
      setTotalCount(result.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!company?.id) {
      return;
    }

    try {
      const response = await fetch(`/api/expenses/stats?company_id=${company.id}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'badge-warning',
      approved: 'badge-info',
      rejected: 'badge-error',
      paid: 'badge-success',
    };
    return styles[status] || 'badge-gray';
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
        <div className="absolute top-60 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
        <div className="absolute bottom-40 left-1/3 w-20 h-20 bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 rounded-full blur-xl"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto py-8 px-6 space-y-8">
        {/* Hero Header */}
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-3 bg-white/70 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl px-6 py-3 shadow-lg mb-6">
            <ReceiptPercentIcon className="w-6 h-6 text-blueox-primary" />
            <span className="text-blueox-primary font-semibold">Expense Management</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
                Business Expenses
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                Track business expenses, manage approvals, and monitor spending patterns
              </p>
            </div>
            
            <Link 
              href="/dashboard/expenses/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Record Expense
              <SparklesIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-sm font-medium text-gray-600 mb-2">This Month (USD)</p>
          <p className="text-2xl lg:text-3xl font-bold text-blueox-primary-dark">{formatCurrency(stats.thisMonth)}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-sm font-medium text-gray-600 mb-2">Pending Approval</p>
          <p className="text-2xl lg:text-3xl font-bold text-amber-600">{stats.pendingApproval}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-sm font-medium text-gray-600 mb-2">Approved</p>
          <p className="text-2xl lg:text-3xl font-bold text-blue-600">{stats.approved}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-green-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-sm font-medium text-gray-600 mb-2">Paid</p>
          <p className="text-2xl lg:text-3xl font-bold text-green-600">{stats.paid}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <FunnelIcon className="w-5 h-5 text-blueox-primary" />
          <h3 className="text-lg font-bold text-blueox-primary-dark">Search & Filter</h3>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by expense number or description..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
            />
          </div>
          <div className="lg:w-54">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ExpenseStatus);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40 appearance-none"
            >
              <option value="all">All Expenses</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blueox-primary/20 border-t-blueox-primary" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blueox-primary/10 rounded-full mb-6">
              <ReceiptPercentIcon className="w-10 h-10 text-blueox-primary" />
            </div>
            <h3 className="text-2xl font-bold text-blueox-primary-dark mb-3">No expenses found</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Start tracking your business expenses to better manage your spending.
            </p>
            <Link 
              href="/dashboard/expenses/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Record Your First Expense
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-blueox-primary/10">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Date</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Expense #</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Description</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Category</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Vendor/Payee</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Amount</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Method</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr 
                      key={expense.id}
                      className="border-b border-blueox-primary/5 hover:bg-blueox-primary/5 transition-colors duration-200 cursor-pointer"
                      onClick={() => window.location.href = `/dashboard/expenses/${expense.id}`}
                    >
                      <td className="py-4 px-6 text-gray-600 whitespace-nowrap">{formatDate(expense.expense_date)}</td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-sm text-blueox-primary font-semibold">{expense.expense_number || '-'}</span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="max-w-xs truncate text-gray-900 font-medium">{expense.description}</p>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-600">
                          {expense.accounts?.name || '-'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-900 font-medium whitespace-nowrap">{expense.vendors?.name || expense.payee || '-'}</td>
                      <td className="py-4 px-6 text-right text-gray-900 font-semibold whitespace-nowrap">
                        {formatCurrency(expense.total, expense.currency || 'USD')}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700">
                          {expense.payment_method}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/dashboard/expenses/${expense.id}`}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blueox-primary/10 hover:bg-blueox-primary/20 text-blueox-primary transition-all duration-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EyeIcon className="w-5 h-5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden p-4 space-y-4">
              {expenses.map((expense) => (
                <div 
                  key={expense.id} 
                  className="bg-white/90 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl p-5 hover:shadow-lg hover:border-blueox-primary/40 transition-all duration-300 cursor-pointer"
                  onClick={() => window.location.href = `/dashboard/expenses/${expense.id}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <p className="text-lg font-bold text-blueox-primary-dark truncate">
                        {expense.description}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{formatDate(expense.expense_date)}</p>
                      {expense.expense_number && (
                        <p className="text-xs font-mono text-gray-500 mt-1">{expense.expense_number}</p>
                      )}
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 ml-2">
                      {expense.payment_method}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blueox-primary/10">
                    {expense.accounts && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500 mb-1">Category</p>
                        <p className="text-sm font-medium text-gray-900">{expense.accounts.name}</p>
                      </div>
                    )}
                    {(expense.vendors || expense.payee) && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500 mb-1">Vendor/Payee</p>
                        <p className="text-sm font-medium text-gray-900">{expense.vendors?.name || expense.payee}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Amount</p>
                      <p className="text-lg font-bold text-blueox-primary">
                        {formatCurrency(expense.total, expense.currency || 'USD')}
                      </p>
                    </div>
                  </div>
                  
                  <Link
                    href={`/dashboard/expenses/${expense.id}`}
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-blueox-primary/10 hover:bg-blueox-primary/20 text-blueox-primary px-4 py-2 rounded-xl font-medium transition-all duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EyeIcon className="w-4 h-4" />
                    View Details
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && expenses.length > 0 && totalPages > 1 && (
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600 font-medium">
              Showing <span className="text-blueox-primary font-bold">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-blueox-primary font-bold">{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="text-blueox-primary font-bold">{totalCount}</span> expenses
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-6 py-2 bg-white border-2 border-blueox-primary/30 text-blueox-primary rounded-xl font-semibold hover:bg-blueox-primary hover:text-black transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-blueox-primary"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-6 py-2 bg-white border-2 border-blueox-primary/30 text-blueox-primary rounded-xl font-semibold hover:bg-blueox-primary hover:text-black transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-blueox-primary"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

