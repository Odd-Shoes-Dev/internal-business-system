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
  TagIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface Category {
  id: string;
  name: string;
  description: string | null;
}
import { ShimmerSkeleton, CardSkeleton, StatsCardSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/card';
import type { Product } from '@/types/database';
import { FitNumber } from '@/components/ui/fit-number';

export default function InventoryPage() {
  const { company } = useCompany();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
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
  const [activeTab, setActiveTab] = useState<'stock' | 'categories'>('stock');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);
  const pageSize = 20;

  useEffect(() => {
    if (!company?.id) return;
    loadInventory();
    loadStats();
  }, [searchQuery, stockFilter, categoryFilter, currentPage, company?.id]);

  useEffect(() => {
    if (company?.id) loadCategories();
  }, [company?.id]);

  useEffect(() => {
    if (activeTab === 'categories' && company?.id) {
      loadCategories();
    }
  }, [activeTab, company?.id]);

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
      if (categoryFilter) {
        params.set('category', categoryFilter);
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
      setStatsLoading(true);
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
    } finally {
      setStatsLoading(false);
    }
  };

  const loadCategories = async () => {
    if (!company?.id) return;
    setCategoriesLoading(true);
    try {
      const response = await fetch(`/api/product-categories?company_id=${company.id}`, { credentials: 'include' });
      const result = await response.json().catch(() => []);
      setCategories(Array.isArray(result) ? result : []);
    } catch (e) {
      console.error('Failed to load categories:', e);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !company?.id) return;
    setSavingCategory(true);
    try {
      const response = await fetch(`/api/product-categories?company_id=${company.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCategories((prev) => [...prev, result]);
      setNewCategoryName('');
      setAddingCategory(false);
    } catch (e) {
      console.error('Failed to add category:', e);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim() || !company?.id) return;
    setSavingCategory(true);
    try {
      const response = await fetch(`/api/product-categories/${editingCategory.id}?company_id=${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editingCategory.name.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCategories((prev) => prev.map((c) => (c.id === editingCategory.id ? result : c)));
      setEditingCategory(null);
    } catch (e) {
      console.error('Failed to update category:', e);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!company?.id || !confirm('Delete this category? Products in this category will be uncategorized.')) return;
    try {
      const response = await fetch(`/api/product-categories/${id}?company_id=${company.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error);
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error('Failed to delete category:', e);
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
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Add Item
              <SparklesIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('stock')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-200 ${activeTab === 'stock' ? 'bg-blueox-primary text-black shadow-md' : 'bg-white/80 backdrop-blur-xl border border-blueox-primary/20 text-blueox-primary hover:border-blueox-primary/40'}`}
        >
          <CubeIcon className="w-4 h-4" />
          Stock
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-200 ${activeTab === 'categories' ? 'bg-blueox-primary text-black shadow-md' : 'bg-white/80 backdrop-blur-xl border border-blueox-primary/20 text-blueox-primary hover:border-blueox-primary/40'}`}
        >
          <TagIcon className="w-4 h-4" />
          Categories
        </button>
      </div>

      {activeTab === 'categories' && (
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TagIcon className="w-5 h-5 text-blueox-primary" />
              <h3 className="text-lg font-bold text-blueox-primary-dark">Product Categories</h3>
            </div>
            <button
              onClick={() => { setAddingCategory(true); setNewCategoryName(''); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark text-black rounded-2xl text-sm font-semibold hover:shadow-lg transition-all"
            >
              <PlusIcon className="w-4 h-4" />
              New Category
            </button>
          </div>

          {addingCategory && (
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } if (e.key === 'Escape') { setAddingCategory(false); } }}
                autoFocus
                placeholder="Category name..."
                className="flex-1 rounded-xl border border-blueox-primary/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary"
              />
              <button onClick={handleAddCategory} disabled={savingCategory || !newCategoryName.trim()} className="inline-flex items-center gap-1 px-4 py-2 bg-blueox-primary text-black rounded-xl text-sm font-semibold disabled:opacity-50">
                <CheckIcon className="w-4 h-4" />
                {savingCategory ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setAddingCategory(false)} className="inline-flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                <XMarkIcon className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}

          {categoriesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <ShimmerSkeleton key={i} className="h-12 w-full rounded-xl" />)}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <TagIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No categories yet</p>
              <p className="text-sm mt-1">Create your first category to organise your products</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-blueox-primary/20 hover:bg-blue-50/30 transition-all group">
                  {editingCategory?.id === cat.id ? (
                    <div className="flex items-center gap-2 flex-1 mr-4">
                      <input
                        type="text"
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUpdateCategory(); } if (e.key === 'Escape') setEditingCategory(null); }}
                        autoFocus
                        className="flex-1 rounded-lg border border-blueox-primary/30 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary"
                      />
                      <button onClick={handleUpdateCategory} disabled={savingCategory} className="p-1.5 bg-blueox-primary text-black rounded-lg">
                        <CheckIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingCategory(null)} className="p-1.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-medium text-gray-800">{cat.name}</span>
                  )}
                  {editingCategory?.id !== cat.id && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingCategory({ id: cat.id, name: cat.name })} className="p-1.5 text-gray-400 hover:text-blueox-primary rounded-lg hover:bg-blue-50 transition-colors">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'stock' && <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {statsLoading ? (
          [1, 2, 3, 4].map((i) => <StatsCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Total Items"
              value={stats.totalItems}
              icon={<CubeIcon className="w-6 h-6" />}
              trend="neutral"
            />
            <StatCard
              title="Total Value"
              value={formatCurrency(stats.totalValue)}
              icon={<ArrowTrendingUpIcon className="w-6 h-6" />}
              trend="up"
            />
            <StatCard
              title="Low Stock"
              value={stats.lowStock}
              icon={<ArrowTrendingDownIcon className="w-6 h-6" />}
              trend={stats.lowStock > 0 ? 'down' : 'neutral'}
            />
            <StatCard
              title="Out of Stock"
              value={stats.outOfStock}
              icon={<ExclamationTriangleIcon className="w-6 h-6" />}
              trend={stats.outOfStock > 0 ? 'down' : 'neutral'}
            />
          </>
        )}
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
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="w-full md:w-48 px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
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
                        <FitNumber value={item.quantity_on_hand} className="font-bold text-blueox-primary-dark" />
                      </div>
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-3 border border-amber-100">
                        <p className="text-xs font-medium text-gray-600 mb-1">Reserved</p>
                        <FitNumber value={item.quantity_reserved} className="font-bold text-amber-600" />
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-3 border border-green-100">
                        <p className="text-xs font-medium text-gray-600 mb-1">Available</p>
                        <FitNumber value={available} className="font-bold text-green-600" />
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
      </>}
    </div>
  );
}

