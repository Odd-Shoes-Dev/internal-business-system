'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { ShimmerSkeleton, CardSkeleton } from '@/components/ui/skeleton';
import type { Product } from '@/types/database';

export default function InventoryPage() {
  const { company } = useCompany();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStock: 0,
    outOfStock: 0,
  });
  const pageSize = 20;

  useEffect(() => {
    if (!company?.id) {
      return;
    }
    loadInventory();
    loadStats();
  }, [searchQuery, stockFilter, currentPage, company?.id]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      if (!company?.id) {
        return;
      }

      const params = new URLSearchParams({
        company_id: company.id,
        page: String(currentPage),
        limit: String(pageSize),
      });
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      if (stockFilter === 'low') {
        params.set('low_stock', 'true');
      }

      const response = await fetch(`/api/inventory?${params.toString()}`, {
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load inventory');
      }

      let inventoryItems = (result.data || []) as Product[];
      if (stockFilter === 'out') {
        inventoryItems = inventoryItems.filter((item) => Number(item.quantity_on_hand || 0) === 0);
      }

      setItems(inventoryItems);
      setTotalCount(
        stockFilter === 'out' ? inventoryItems.length : Number(result.pagination?.total || inventoryItems.length)
      );
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      if (!company?.id) {
        return;
      }

      const response = await fetch(`/api/inventory/stats?company_id=${company.id}`, {
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

  const getStockStatus = (item: Product) => {
    if ((item.quantity_on_hand || 0) === 0) {
      return { label: 'Out of Stock', class: 'badge-error', icon: ExclamationTriangleIcon };
    }
    if ((item.quantity_on_hand || 0) <= (item.reorder_point || 0)) {
      return { label: 'Low Stock', class: 'badge-warning', icon: ArrowTrendingDownIcon };
    }
    return { label: 'In Stock', class: 'badge-success', icon: ArrowTrendingUpIcon };
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-4 sm:p-6 lg:p-8">
      {/* Hero Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-full px-6 py-3 mb-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <Squares2X2Icon className="w-6 h-6 text-blueox-primary" />
          <span className="font-bold text-blueox-primary-dark text-lg">Inventory Management</span>
          <SparklesIcon className="w-5 h-5 text-cyan-500" />
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blueox-primary via-blue-600 to-cyan-500 mb-2">
              Stock Control
            </h1>
            <p className="text-gray-600 text-lg">Track and manage your inventory levels</p>
          </div>
          <div className="flex gap-3">
            <Link 
              href="/dashboard/inventory/movements" 
              className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 hover:border-blueox-primary/40 text-blueox-primary px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              Stock Movements
            </Link>
            <Link 
              href="/dashboard/inventory/new" 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Add Item
            </Link>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <div className="bg-white/80 backdrop-blur-xl border-l-4 border-blue-500 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Total Items</p>
              <p className="text-3xl font-extrabold text-blueox-primary-dark group-hover:text-blueox-primary transition-colors">
                {stats.totalItems}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-2xl group-hover:bg-blue-200 transition-colors">
              <CubeIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl border-l-4 border-green-500 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Total Value</p>
              <p className="text-3xl font-extrabold text-blueox-primary-dark group-hover:text-green-600 transition-colors">
                {formatCurrency(stats.totalValue)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-2xl group-hover:bg-green-200 transition-colors">
              <ArrowTrendingUpIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl border-l-4 border-amber-500 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Low Stock</p>
              <p className="text-3xl font-extrabold text-amber-600 group-hover:text-amber-700 transition-colors">
                {stats.lowStock}
              </p>
            </div>
            <div className="p-3 bg-amber-100 rounded-2xl group-hover:bg-amber-200 transition-colors">
              <ArrowTrendingDownIcon className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl border-l-4 border-red-500 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Out of Stock</p>
              <p className="text-3xl font-extrabold text-red-600 group-hover:text-red-700 transition-colors">
                {stats.outOfStock}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-2xl group-hover:bg-red-200 transition-colors">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
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
              placeholder="Search by name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
            />
          </div>
          <select
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full md:w-48 px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
          >
            <option value="all">All Items</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Inventory List */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white/80 backdrop-blur-xl border-l-4 border-gray-200 rounded-3xl p-6 shadow-xl">
                <ShimmerSkeleton className="h-4 w-20 mb-3" />
                <ShimmerSkeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
          <div className="hidden md:block bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <ShimmerSkeleton className="h-5 w-48" />
                  <ShimmerSkeleton className="h-5 w-24" />
                  <ShimmerSkeleton className="h-5 w-20" />
                  <ShimmerSkeleton className="h-5 w-20" />
                  <ShimmerSkeleton className="h-5 w-20" />
                  <ShimmerSkeleton className="h-5 w-24" />
                  <ShimmerSkeleton className="h-5 w-24" />
                  <ShimmerSkeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="md:hidden space-y-3">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-16 shadow-xl text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
            <CubeIcon className="w-10 h-10 text-blueox-primary" />
          </div>
          <h3 className="text-2xl font-bold text-blueox-primary-dark mb-3">No inventory items found</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Add your first inventory item to start tracking stock
          </p>
          <Link 
            href="/dashboard/inventory/new" 
            className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
          >
            <PlusIcon className="w-5 h-5" />
            Add Your First Item
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-blueox-primary/10 bg-gradient-to-r from-blue-50 to-cyan-50">
                    <th className="text-left py-5 px-6 text-sm font-bold text-blueox-primary-dark uppercase tracking-wide">Item</th>
                    <th className="text-left py-5 px-6 text-sm font-bold text-blueox-primary-dark uppercase tracking-wide">SKU</th>
                    <th className="text-right py-5 px-6 text-sm font-bold text-blueox-primary-dark uppercase tracking-wide">On Hand</th>
                    <th className="text-right py-5 px-6 text-sm font-bold text-blueox-primary-dark uppercase tracking-wide">Reserved</th>
                    <th className="text-right py-5 px-6 text-sm font-bold text-blueox-primary-dark uppercase tracking-wide">Available</th>
                    <th className="text-right py-5 px-6 text-sm font-bold text-blueox-primary-dark uppercase tracking-wide">Unit Cost</th>
                    <th className="text-right py-5 px-6 text-sm font-bold text-blueox-primary-dark uppercase tracking-wide">Total Value</th>
                    <th className="text-left py-5 px-6 text-sm font-bold text-blueox-primary-dark uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                {items.map((item) => {
                  const status = getStockStatus(item);
                  const available = (item.quantity_on_hand || 0) - (item.quantity_reserved || 0);
                  return (
                    <tr key={item.id} className="border-b border-blueox-primary/5 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-cyan-50/50 transition-all duration-200">
                      <td className="py-4 px-6">
                        <Link
                          href={`/dashboard/inventory/${item.id}`}
                          className="font-semibold text-blueox-primary hover:text-blueox-primary-dark transition-colors"
                        >
                          {item.name}
                        </Link>
                        {item.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs mt-1">{item.description}</p>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{item.sku || '-'}</span>
                      </td>
                      <td className="py-4 px-6 text-right font-semibold text-blueox-primary-dark">
                        {item.quantity_on_hand} {item.unit_of_measure}
                      </td>
                      <td className="py-4 px-6 text-right text-gray-500">
                        {item.quantity_reserved}
                      </td>
                      <td className="py-4 px-6 text-right font-semibold text-blueox-primary-dark">
                        {available} {item.unit_of_measure}
                      </td>
                      <td className="py-4 px-6 text-right text-gray-700">{formatCurrency(item.cost_price, item.currency)}</td>
                      <td className="py-4 px-6 text-right font-bold text-blueox-primary-dark">
                        {formatCurrency((item.quantity_on_hand || 0) * (item.cost_price || 0), item.currency)}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`badge ${status.class}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden grid gap-4">
            {items.map((item) => {
              const status = getStockStatus(item);
              const available = (item.quantity_on_hand || 0) - (item.quantity_reserved || 0);
              return (
                <div key={item.id} className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-5 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <Link
                          href={`/dashboard/inventory/${item.id}`}
                          className="font-bold text-blueox-primary hover:text-blueox-primary-dark transition-colors"
                        >
                          {item.name}
                        </Link>
                        <p className="text-sm text-gray-500 font-mono mt-1">{item.sku || '-'}</p>
                      </div>
                      <span className={`badge ${status.class}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-3 border border-blue-100">
                        <p className="text-xs font-medium text-gray-600 mb-1">On Hand</p>
                        <p className="text-lg font-bold text-blueox-primary-dark">{item.quantity_on_hand}</p>
                      </div>
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-3 border border-amber-100">
                        <p className="text-xs font-medium text-gray-600 mb-1">Reserved</p>
                        <p className="text-lg font-bold text-amber-600">{item.quantity_reserved}</p>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-3 border border-green-100">
                        <p className="text-xs font-medium text-gray-600 mb-1">Available</p>
                        <p className="text-lg font-bold text-green-600">{available}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-blueox-primary/10 flex justify-between items-center">
                      <div>
                        <span className="text-sm text-gray-500">Total Value:</span>
                        <span className="ml-2 text-lg font-bold text-blueox-primary-dark">
                          {formatCurrency((item.quantity_on_hand || 0) * (item.cost_price || 0))}
                        </span>
                      </div>
                      <Link
                        href={`/dashboard/inventory/${item.id}`}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark text-white px-4 py-2 rounded-xl font-semibold text-sm hover:shadow-lg transition-all duration-300 hover:scale-105"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600">
                Showing <span className="font-bold text-blueox-primary">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-blueox-primary">{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="font-bold text-blueox-primary">{totalCount}</span> items
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-6 py-3 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 hover:border-blueox-primary/40 text-blueox-primary rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-6 py-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

