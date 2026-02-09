'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  SparklesIcon,
  ShoppingCartIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface PurchaseOrder {
  id: string;
  po_number: string;
  order_date: string;
  expected_date: string | null;
  total: number;
  currency: string;
  status: string;
  vendors?: {
    name: string;
    company_name: string | null;
  };
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    draft: 0,
    sent: 0,
    partial: 0,
    received: 0,
    totalValue: 0,
  });
  const pageSize = 20;

  useEffect(() => {
    loadOrders();
    loadStats();
  }, [searchQuery, statusFilter, currentPage]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (
            name,
            company_name
          )
        `, { count: 'exact' })
        .order('order_date', { ascending: false });

      if (searchQuery) {
        query = query.or(`po_number.ilike.%${searchQuery}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setOrders(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Failed to load purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('status, total, currency');

      if (error) throw error;

      const stats = {
        draft: data?.filter(o => o.status === 'draft').length || 0,
        sent: data?.filter(o => o.status === 'sent').length || 0,
        partial: data?.filter(o => o.status === 'partial').length || 0,
        received: data?.filter(o => o.status === 'received').length || 0,
        totalValue: data?.reduce((sum, o) => sum + Number(o.total || 0), 0) || 0,
      };
      setStats(stats);
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
    const badges: Record<string, { label: string; class: string; icon: any }> = {
      draft: { label: 'Draft', class: 'badge-gray', icon: DocumentTextIcon },
      sent: { label: 'Sent', class: 'badge-info', icon: ClockIcon },
      approved: { label: 'Approved', class: 'badge-success', icon: CheckCircleIcon },
      partial: { label: 'Partially Received', class: 'badge-warning', icon: TruckIcon },
      received: { label: 'Received', class: 'badge-success', icon: CheckCircleIcon },
      cancelled: { label: 'Cancelled', class: 'badge-error', icon: XCircleIcon },
    };
    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.class}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
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
            <ShoppingCartIcon className="w-6 h-6 text-blueox-primary" />
            <span className="text-blueox-primary font-semibold">Purchase Order Management</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
                Purchase Orders
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                Manage purchase orders from vendors and track deliveries
              </p>
            </div>
            
            <Link 
              href="/dashboard/purchase-orders/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              New Purchase Order
              <SparklesIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 lg:gap-6">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-2xl lg:text-3xl font-bold text-gray-700">{stats.draft}</p>
          <p className="text-sm font-medium text-gray-600 mt-2">Draft</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-2xl lg:text-3xl font-bold text-blue-600">{stats.sent}</p>
          <p className="text-sm font-medium text-gray-600 mt-2">Sent</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-2xl lg:text-3xl font-bold text-amber-600">{stats.partial}</p>
          <p className="text-sm font-medium text-gray-600 mt-2">Partial</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-green-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-2xl lg:text-3xl font-bold text-green-600">{stats.received}</p>
          <p className="text-sm font-medium text-gray-600 mt-2">Received</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-2xl lg:text-3xl font-bold text-blueox-primary">{formatCurrency(stats.totalValue)}</p>
          <p className="text-sm font-medium text-gray-600 mt-2">Total Value</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <FunnelIcon className="w-5 h-5 text-blueox-primary" />
          <h3 className="text-lg font-bold text-blueox-primary-dark">Search & Filter</h3>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by PO number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-56 px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="approved">Approved</option>
            <option value="partial">Partially Received</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Purchase Orders List */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-12 w-12 border-4 border-blueox-primary/20 border-t-blueox-primary rounded-full" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
              <DocumentTextIcon className="w-10 h-10 text-blueox-primary" />
            </div>
            <h3 className="text-2xl font-bold text-blueox-primary-dark mb-3">No purchase orders found</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Create your first purchase order to get started
            </p>
            <Link 
              href="/dashboard/purchase-orders/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              New Purchase Order
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-blueox-primary/10">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">PO Number</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Vendor</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Order Date</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Expected Date</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Amount</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Status</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-blueox-primary/5 hover:bg-blueox-primary/5 transition-colors duration-200">
                      <td className="py-4 px-6">
                        <Link 
                          href={`/dashboard/purchase-orders/${order.id}`}
                          className="font-semibold text-blueox-primary hover:text-blueox-primary-hover hover:underline transition-all duration-200"
                        >
                          {order.po_number}
                        </Link>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-900 font-medium">
                          {order.vendors?.company_name || order.vendors?.name || 'N/A'}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-900">{formatDate(order.order_date)}</td>
                      <td className="py-4 px-6 text-gray-900">{order.expected_date ? formatDate(order.expected_date) : '-'}</td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(order.total, order.currency)}
                        </span>
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(order.status)}</td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/dashboard/purchase-orders/${order.id}`}
                          className="inline-flex items-center px-4 py-2 bg-blueox-primary/10 hover:bg-blueox-primary/20 text-blueox-primary rounded-xl font-medium transition-all duration-200"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-6 border-t border-blueox-primary/10">
                <p className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} orders
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white border border-blueox-primary/20 rounded-xl font-medium text-gray-700 hover:bg-blueox-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white border border-blueox-primary/20 rounded-xl font-medium text-gray-700 hover:bg-blueox-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
