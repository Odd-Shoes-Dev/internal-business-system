'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  AdjustmentsHorizontalIcon,
  ShoppingCartIcon,
  ArchiveBoxIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  quantity_on_hand: number;
  unit_of_measure: string;
  cost_price: number;
}

interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  products?: {
    name: string;
    sku: string;
  };
}

export default function StockMovementsPage() {
  const { company } = useCompany();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: '',
    quantity_change: 0,
    reason: 'adjustment',
    notes: '',
    adjustment_date: new Date().toISOString().split('T')[0],
    unit_cost: 0,
  });

  useEffect(() => {
    if (!company?.id) {
      return;
    }
    loadMovements();
  }, [searchQuery, typeFilter, currentPage, company?.id]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      if (!company?.id) {
        return;
      }

      const params = new URLSearchParams({ company_id: company.id });
      if (typeFilter !== 'all') {
        params.set('reason', typeFilter);
      }

      const response = await fetch(`/api/inventory-adjustments?${params.toString()}`, {
        credentials: 'include',
      });
      const result = await response.json().catch(() => ([]));
      if (!response.ok) {
        throw new Error((result as any)?.error || 'Failed to load movements');
      }

      let filtered = Array.isArray(result) ? result : [];
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        filtered = filtered.filter((row: any) => {
          const name = String(row.products?.name || '').toLowerCase();
          const sku = String(row.products?.sku || '').toLowerCase();
          return name.includes(search) || sku.includes(search);
        });
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize;
      const paged = filtered.slice(from, to);

      setMovements(paged || []);
      setTotalCount(filtered.length || 0);
    } catch (error) {
      console.error('Failed to load movements:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    if (!company?.id) return;
    try {
      const res = await fetch(`/api/inventory?company_id=${company.id}&limit=1000`, { credentials: 'include' });
      const result = await res.json();
      setProducts(result.data || []);
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  };

  const openModal = () => {
    loadProducts();
    setForm({
      product_id: '',
      quantity_change: 0,
      reason: 'adjustment',
      notes: '',
      adjustment_date: new Date().toISOString().split('T')[0],
      unit_cost: 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.product_id) return;
    if (form.quantity_change === 0) return;
    if (!company?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory-adjustments?company_id=${company.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          adjustment_date: new Date(form.adjustment_date).toISOString(),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save');
      setShowModal(false);
      loadMovements();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === form.product_id);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return currencyFormatter(amount, (company?.currency || 'USD') as any);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'purchase_order':
        return <ShoppingCartIcon className="w-5 h-5 text-green-600" />;
      case 'sale':
      case 'invoice':
        return <ArchiveBoxIcon className="w-5 h-5 text-blue-600" />;
      case 'adjustment':
        return <AdjustmentsHorizontalIcon className="w-5 h-5 text-orange-600" />;
      case 'return':
        return <ArrowUpIcon className="w-5 h-5 text-purple-600" />;
      default:
        return <AdjustmentsHorizontalIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'purchase_order':
      case 'return':
        return 'text-green-600 bg-green-50';
      case 'sale':
      case 'invoice':
        return 'text-blue-600 bg-blue-50';
      case 'adjustment':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const isInbound = (type: string) => {
    return ['purchase', 'purchase_order', 'return', 'adjustment_in'].includes(type);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/inventory" className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Movements</h1>
            <p className="text-gray-500 mt-1">Track all inventory transactions</p>
          </div>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blueox-primary text-black rounded-2xl font-semibold text-sm hover:shadow-lg transition-all"
        >
          <PlusIcon className="w-4 h-4" />
          Record Adjustment
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Product</label>
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary focus:border-blueox-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Movement Type</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary focus:border-blueox-primary"
            >
              <option value="all">All Types</option>
              <option value="purchase">Purchase</option>
              <option value="sale">Sale</option>
              <option value="adjustment">Adjustment</option>
              <option value="return">Return</option>
              <option value="write_off">Write Off</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Movements List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blueox-primary" />
        </div>
      ) : movements.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <AdjustmentsHorizontalIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No stock movements found.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Cost
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(movement.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {movement.products?.name || 'Unknown Product'}
                          </p>
                          {movement.products?.sku && (
                            <p className="text-xs text-gray-500">SKU: {movement.products.sku}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getMovementIcon(movement.movement_type)}
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getMovementColor(movement.movement_type)}`}>
                            {movement.movement_type.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className={isInbound(movement.movement_type) ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {isInbound(movement.movement_type) ? '+' : '-'}
                          {movement.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(movement.unit_cost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {formatCurrency(movement.total_cost)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {movement.reference_type && (
                            <p className="text-gray-900 capitalize">{movement.reference_type.replace('_', ' ')}</p>
                          )}
                          {movement.notes && (
                            <p className="text-xs text-gray-500 truncate max-w-xs">{movement.notes}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-4">
              <p className="text-sm text-gray-500">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} movements
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {/* Record Adjustment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">Record Stock Adjustment</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Product */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product <span className="text-red-500">*</span></label>
                <select
                  value={form.product_id}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value);
                    setForm((f) => ({ ...f, product_id: e.target.value, unit_cost: p ? Number(p.cost_price) : 0 }));
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary"
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                  ))}
                </select>
                {selectedProduct && (
                  <p className="text-xs text-gray-500 mt-1">
                    Current stock: <span className="font-medium">{Number(selectedProduct.quantity_on_hand)} {selectedProduct.unit_of_measure}</span>
                  </p>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                <select
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary"
                >
                  <option value="adjustment">Adjustment (stock count correction)</option>
                  <option value="purchase">Purchase (stock received)</option>
                  <option value="return">Return (customer returned)</option>
                  <option value="write_off">Write Off (damaged / expired / stolen)</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity Change <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.quantity_change}
                  onChange={(e) => setForm((f) => ({ ...f, quantity_change: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary"
                  placeholder="Use negative for stock reduction e.g. -5"
                />
                {selectedProduct && form.quantity_change !== 0 && (
                  <p className="text-xs mt-1">
                    New stock: <span className={`font-medium ${Number(selectedProduct.quantity_on_hand) + form.quantity_change < 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {Number(selectedProduct.quantity_on_hand) + form.quantity_change} {selectedProduct.unit_of_measure}
                    </span>
                  </p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={form.adjustment_date}
                  onChange={(e) => setForm((f) => ({ ...f, adjustment_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Reason</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="e.g. Stock count on 13 Jul found 5 units missing"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.product_id || form.quantity_change === 0}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

