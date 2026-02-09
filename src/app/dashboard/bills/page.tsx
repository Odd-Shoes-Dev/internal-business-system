'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentTextIcon,
  EyeIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { ShimmerSkeleton, CardSkeleton } from '@/components/ui/skeleton';
import type { Bill } from '@/types/database';

type BillStatus = 'all' | 'draft' | 'pending' | 'partial' | 'paid' | 'overdue';

interface BillWithVendor extends Bill {
  vendors?: { name: string } | null;
}

export default function BillsPage() {
  const [bills, setBills] = useState<BillWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    totalUnpaid: 0,
    dueThisWeek: 0,
    overdue: 0,
    paidThisMonth: 0,
  });
  const pageSize = 20;

  useEffect(() => {
    loadBills();
    loadStats();
  }, [searchQuery, statusFilter, currentPage]);

  const loadBills = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('bills')
        .select(`
          *,
          vendors (name)
        `, { count: 'exact' })
        .order('bill_date', { ascending: false });

      if (searchQuery) {
        query = query.or(`bill_number.ilike.%${searchQuery}%,reference.ilike.%${searchQuery}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setBills(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Failed to load bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/bills/stats');
      if (!response.ok) throw new Error('Failed to load stats');
      
      const data = await response.json();
      setStats(data);
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
      draft: 'badge-gray',
      pending: 'badge-warning',
      partial: 'badge-info',
      paid: 'badge-success',
      overdue: 'badge-error',
      void: 'badge-gray',
    };
    return styles[status] || 'badge-gray';
  };

  const isOverdue = (bill: BillWithVendor) => {
    if (bill.status === 'paid' || bill.status === 'void') return false;
    return new Date(bill.due_date) < new Date();
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
            <DocumentTextIcon className="w-6 h-6 text-blueox-primary" />
            <span className="text-blueox-primary font-semibold">Bill Management</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
                Vendor Bills & Payables
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                Track vendor bills, manage payment schedules, and monitor outstanding payables
              </p>
            </div>
            
            <Link 
              href="/dashboard/bills/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Create New Bill
              <SparklesIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-sm font-medium text-gray-600 mb-2">Total Unpaid</p>
          <p className="text-2xl lg:text-3xl font-bold text-blueox-primary-dark">
            {formatCurrency(stats.totalUnpaid)}
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-sm font-medium text-gray-600 mb-2">Due This Week</p>
          <p className="text-2xl lg:text-3xl font-bold text-amber-600">
            {formatCurrency(stats.dueThisWeek)}
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-red-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-sm font-medium text-gray-600 mb-2">Overdue</p>
          <p className="text-2xl lg:text-3xl font-bold text-red-600">
            {formatCurrency(stats.overdue)}
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-green-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-sm font-medium text-gray-600 mb-2">Paid This Month</p>
          <p className="text-2xl lg:text-3xl font-bold text-green-600">
            {formatCurrency(stats.paidThisMonth)}
          </p>
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
              placeholder="Search by bill number or reference..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
            />
          </div>
          <div className="lg:w-48">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as BillStatus);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40 appearance-none"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bills List */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-8">
            {/* Loading Skeletons */}
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="border border-blueox-primary/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <ShimmerSkeleton className="h-6 w-32" />
                    <ShimmerSkeleton className="h-6 w-20" />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <ShimmerSkeleton className="h-5 w-full" />
                    <ShimmerSkeleton className="h-5 w-full" />
                    <ShimmerSkeleton className="h-5 w-full" />
                    <ShimmerSkeleton className="h-5 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blueox-primary/10 rounded-full mb-6">
              <DocumentTextIcon className="w-10 h-10 text-blueox-primary" />
            </div>
            <h3 className="text-2xl font-bold text-blueox-primary-dark mb-3">No bills found</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Get started by recording your first vendor bill to track payables.
            </p>
            <Link 
              href="/dashboard/bills/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Create Your First Bill
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-blueox-primary/10">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Bill #</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Vendor</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Bill Date</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Due Date</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Amount</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Balance</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Status</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr 
                      key={bill.id}
                      className="border-b border-blueox-primary/5 hover:bg-blueox-primary/5 transition-colors duration-200"
                    >
                      <td className="py-4 px-6">
                        <Link
                          href={`/dashboard/bills/${bill.id}`}
                          className="font-mono text-blueox-primary hover:text-blueox-primary-hover font-semibold hover:underline transition-all duration-200"
                        >
                          {bill.bill_number}
                        </Link>
                      </td>
                      <td className="py-4 px-6 text-gray-900 font-medium">{bill.vendors?.name || '-'}</td>
                      <td className="py-4 px-6 text-gray-600 whitespace-nowrap">{formatDate(bill.bill_date)}</td>
                      <td className={`py-4 px-6 whitespace-nowrap font-medium ${isOverdue(bill) ? 'text-red-600' : 'text-gray-600'}`}>
                        {formatDate(bill.due_date)}
                      </td>
                      <td className="py-4 px-6 text-right text-gray-900 font-semibold">
                        {formatCurrency(bill.total, bill.currency || 'USD')}
                      </td>
                      <td className="py-4 px-6 text-right text-gray-900 font-semibold">
                        {formatCurrency(bill.total - bill.amount_paid, bill.currency || 'USD')}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`${isOverdue(bill) ? 'badge-error' : getStatusBadge(bill.status)}`}>
                          {isOverdue(bill) ? 'Overdue' : bill.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/dashboard/bills/${bill.id}`}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blueox-primary/10 hover:bg-blueox-primary/20 text-blueox-primary transition-all duration-200"
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
              {bills.map((bill) => (
                <div 
                  key={bill.id} 
                  className="bg-white/90 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl p-5 hover:shadow-lg hover:border-blueox-primary/40 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <Link
                        href={`/dashboard/bills/${bill.id}`}
                        className="text-lg font-bold font-mono text-blueox-primary hover:text-blueox-primary-hover hover:underline transition-all duration-200"
                      >
                        {bill.bill_number}
                      </Link>
                      <p className="text-sm text-gray-600 mt-1">{bill.vendors?.name || '-'}</p>
                    </div>
                    <span className={`${isOverdue(bill) ? 'badge-error' : getStatusBadge(bill.status)}`}>
                      {isOverdue(bill) ? 'Overdue' : bill.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blueox-primary/10">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Bill Date</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(bill.bill_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Due Date</p>
                      <p className={`text-sm font-medium ${isOverdue(bill) ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatDate(bill.due_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total Amount</p>
                      <p className="text-sm font-bold text-blueox-primary">
                        {formatCurrency(bill.total, bill.currency || 'USD')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Balance</p>
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(bill.total - bill.amount_paid, bill.currency || 'USD')}
                      </p>
                    </div>
                  </div>
                  
                  <Link
                    href={`/dashboard/bills/${bill.id}`}
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-blueox-primary/10 hover:bg-blueox-primary/20 text-blueox-primary px-4 py-2 rounded-xl font-medium transition-all duration-200"
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
      {!loading && bills.length > 0 && totalPages > 1 && (
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600 font-medium">
              Showing <span className="text-blueox-primary font-bold">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-blueox-primary font-bold">{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="text-blueox-primary font-bold">{totalCount}</span> bills
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
  );
}

