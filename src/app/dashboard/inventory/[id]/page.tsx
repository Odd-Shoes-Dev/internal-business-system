'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CubeIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { FitNumber } from '@/components/ui/fit-number';

interface Product {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  product_type: 'inventory' | 'non_inventory' | 'service';
  unit_price: number;
  cost_price: number;
  currency: string;
  track_inventory: boolean;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_point: number | null;
  reorder_quantity: number | null;
  unit_of_measure: string;
  revenue_account_id: string | null;
  cogs_account_id: string | null;
  inventory_account_id: string | null;
  is_taxable: boolean;
  tax_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  revenue_account?: {
    name: string;
    code: string;
  };
  cogs_account?: {
    name: string;
    code: string;
  };
  inventory_account?: {
    name: string;
    code: string;
  };
  product_category?: {
    id: string;
    name: string;
  };
}

export default function InventoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [item, setItem] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    quantity_change: 0,
    reason: 'adjustment',
    notes: '',
    adjustment_date: new Date().toISOString().split('T')[0],
  });
  const [savingAdjust, setSavingAdjust] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadItemDetails();
    }
  }, [params.id]);

  const loadItemDetails = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/products/${params.id}`, {
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load item');
      }

      const mapped = {
        ...result.data,
        quantity_available:
          Number(result.data?.quantity_on_hand || 0) - Number(result.data?.quantity_reserved || 0),
        product_category: result.data?.product_categories
          ? {
              id: String(result.data.category_id || ''),
              name: result.data.product_categories.name,
            }
          : null,
      };
      setItem(mapped as Product);
    } catch (error) {
      console.error('Failed to load item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/products/${params.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete item');
      }

      router.push('/dashboard/inventory');
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('Failed to delete item');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  const getStockStatus = () => {
    if (!item) return { label: '', class: '', icon: CubeIcon };
    
    if ((item.quantity_on_hand || 0) === 0) {
      return { label: 'Out of Stock', class: 'badge-error', icon: ExclamationTriangleIcon };
    }
    if ((item.quantity_on_hand || 0) <= (item.reorder_point || 0)) {
      return { label: 'Low Stock', class: 'badge-warning', icon: ArrowTrendingDownIcon };
    }
    return { label: 'In Stock', class: 'badge-success', icon: ArrowTrendingUpIcon };
  };

  const handleSaveAdjustment = async () => {
    if (!item || adjustForm.quantity_change === 0) return;
    setSavingAdjust(true);
    try {
      const res = await fetch(`/api/inventory-adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          product_id: item.id,
          ...adjustForm,
          adjustment_date: new Date(adjustForm.adjustment_date).toISOString(),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save');
      setShowAdjustModal(false);
      loadItemDetails();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingAdjust(false);
    }
  };

  const formatQty = (val: number | string | null | undefined) => {
    const n = Number(val || 0);
    return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(2)).toString();
  };

  const calculateGrossMargin = () => {
    if (!item) return '0.0%';
    const price = Number(item.unit_price || 0);
    const cost = Number(item.cost_price || 0);
    if (price === 0) return '0.0%';
    return (((price - cost) / price) * 100).toFixed(1) + '%';
  };

  const calculateTotalValue = () => {
    if (!item) return 0;
    return (item.quantity_on_hand || 0) * (item.cost_price || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-600"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Item not found</p>
        <Link href="/dashboard/inventory" className="btn-secondary mt-4">
          Back to Inventory
        </Link>
      </div>
    );
  }

  const status = getStockStatus();
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/inventory" className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
            <p className="text-gray-500 mt-1">SKU: {item.sku || 'N/A'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setAdjustForm({ quantity_change: 0, reason: 'adjustment', notes: '', adjustment_date: new Date().toISOString().split('T')[0] });
              setShowAdjustModal(true);
            }}
            className="btn-secondary"
          >
            <AdjustmentsHorizontalIcon className="w-5 h-5 mr-2" />
            Adjust Stock
          </button>
          <Link
            href={`/dashboard/inventory/${item.id}/edit`}
            className="btn-secondary"
          >
            <PencilIcon className="w-5 h-5 mr-2" />
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={actionLoading}
            className="btn-ghost text-red-600 hover:bg-red-50"
          >
            <TrashIcon className="w-5 h-5 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <span className={`badge ${status.class} flex items-center gap-2`}>
          <StatusIcon className="w-4 h-4" />
          {status.label}
        </span>
        {!item.is_active && (
          <span className="badge badge-gray">Inactive</span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">On Hand</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatQty(item.quantity_on_hand)} {item.unit_of_measure}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Reserved</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatQty(item.quantity_reserved)} {item.unit_of_measure}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Available</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatQty(Number(item.quantity_on_hand || 0) - Number(item.quantity_reserved || 0))} {item.unit_of_measure}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Total Value</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(calculateTotalValue(), item.currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Information */}
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CubeIcon className="w-5 h-5" />
              Product Information
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Product Name</p>
                <p className="font-medium text-gray-900">{item.name}</p>
              </div>
              {item.description && (
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="text-gray-900">{item.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">SKU</p>
                <p className="font-mono text-gray-900">{item.sku || 'N/A'}</p>
              </div>
              {item.product_category && (
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="text-gray-900">{item.product_category.name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Unit of Measure</p>
                <p className="text-gray-900 capitalize">{item.unit_of_measure}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Product Type</p>
                <p className="text-gray-900 capitalize">{item.product_type.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tax Status</p>
                <p className="text-gray-900">
                  {item.is_taxable ? `Taxable (${item.tax_rate || 0}%)` : 'Non-taxable'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Information */}
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5" />
              Pricing & Margin
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Currency</p>
                <p className="font-medium text-gray-900">{item.currency}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Unit Cost</p>
                <p className="font-medium text-gray-900">{formatCurrency(item.cost_price, item.currency)}</p>
                <p className="text-xs text-gray-500 mt-1">Your purchase cost</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Selling Price</p>
                <p className="font-medium text-gray-900">{formatCurrency(item.unit_price, item.currency)}</p>
                <p className="text-xs text-gray-500 mt-1">Customer price</p>
              </div>
              <div className="pt-3 border-t">
                <p className="text-sm text-gray-500">Gross Margin</p>
                <FitNumber value={calculateGrossMargin()} className="font-bold text-green-600" />
                <p className="text-xs text-gray-500 mt-1">Profit margin</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Levels */}
      <div className="card">
        <div className="card-body">
          <h2 className="font-semibold text-gray-900 mb-4">Stock Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Quantity on Hand</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">
                {formatQty(item.quantity_on_hand)} {item.unit_of_measure}
              </p>
              <p className="text-xs text-gray-500 mt-1">Current stock count</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Reserved</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">
                {formatQty(item.quantity_reserved)} {item.unit_of_measure}
              </p>
              <p className="text-xs text-gray-500 mt-1">Allocated to orders</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Reorder Point</p>
              <p className="text-xl font-semibold text-amber-600 mt-1">
                {formatQty(item.reorder_point)} {item.unit_of_measure}
              </p>
              <p className="text-xs text-gray-500 mt-1">Alert when stock falls below</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Reorder Quantity</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">
                {formatQty(item.reorder_quantity)} {item.unit_of_measure}
              </p>
              <p className="text-xs text-gray-500 mt-1">Suggested order amount</p>
            </div>
          </div>
        </div>
      </div>

      {/* Accounting Configuration */}
      {(item.revenue_account || item.cogs_account || item.inventory_account) && (
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold text-gray-900 mb-4">Accounting Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {item.revenue_account && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Revenue Account</p>
                  <p className="font-medium text-gray-900">{item.revenue_account.code} - {item.revenue_account.name}</p>
                </div>
              )}
              {item.cogs_account && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">COGS Account</p>
                  <p className="font-medium text-gray-900">{item.cogs_account.code} - {item.cogs_account.name}</p>
                </div>
              )}
              {item.inventory_account && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Inventory Account</p>
                  <p className="font-medium text-gray-900">{item.inventory_account.code} - {item.inventory_account.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="card">
        <div className="card-body">
          <h2 className="font-semibold text-gray-900 mb-4">Additional Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="text-gray-900">{new Date(item.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="text-gray-900">{new Date(item.updated_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Track Inventory</p>
              <p className="text-gray-900">{item.track_inventory ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-gray-900">{item.is_active ? 'Active' : 'Inactive'}</p>
            </div>
          </div>
        </div>
      </div>
      {/* Adjust Stock Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Adjust Stock</h2>
                <p className="text-sm text-gray-500 mt-0.5">{item.name} — current: {formatQty(item.quantity_on_hand)} {item.unit_of_measure}</p>
              </div>
              <button onClick={() => setShowAdjustModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary"
                >
                  <option value="adjustment">Adjustment (stock count correction)</option>
                  <option value="purchase">Purchase (stock received)</option>
                  <option value="return">Return (customer returned)</option>
                  <option value="write_off">Write Off (damaged / expired / stolen)</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Change <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={adjustForm.quantity_change}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, quantity_change: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary"
                  placeholder="Positive to add, negative to reduce e.g. -5"
                />
                {adjustForm.quantity_change !== 0 && (
                  <p className="text-xs mt-1">
                    New stock: <span className={`font-medium ${Number(item.quantity_on_hand) + adjustForm.quantity_change < 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {formatQty(Number(item.quantity_on_hand) + adjustForm.quantity_change)} {item.unit_of_measure}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={adjustForm.adjustment_date}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, adjustment_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Reason</label>
                <textarea
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="e.g. Physical count found 3 extra units"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowAdjustModal(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleSaveAdjustment}
                disabled={savingAdjust || adjustForm.quantity_change === 0}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingAdjust ? 'Saving...' : 'Save Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
