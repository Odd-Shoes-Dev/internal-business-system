'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCompany } from '@/contexts/company-context';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  CubeIcon,
  XMarkIcon,
  CheckIcon,
  ArrowRightIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  product_type: string;
  unit_price: number;
  cost_price: number;
  currency: string;
  unit_of_measure: string;
  is_taxable: boolean;
  tax_rate: number;
  track_inventory: boolean;
  quantity_on_hand: number;
  is_active: boolean;
}

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  description: '',
  product_type: 'service',
  unit_price: 0,
  cost_price: 0,
  currency: 'USD',
  unit_of_measure: 'each',
  is_taxable: false,
  tax_rate: 0,
};

export default function ProductsPage() {
  const { company, companyModules } = useCompany();
  const hasInventory = companyModules.includes('inventory');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Scan-to-register state
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [scanResult, setScanResult] = useState<{ found: boolean; product?: Product } | null>(null);
  const [scanning, setScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (company) {
      setForm(f => ({ ...f, currency: company.currency || 'USD' }));
      loadProducts();
    }
  }, [company, search]);

  const loadProducts = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ company_id: company.id, limit: '200' });
      if (search) q.set('search', search);
      const res = await fetch(`/api/products?${q}`, { credentials: 'include' });
      const data = await res.json();
      setProducts(data.data || []);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditProduct(null);
    setForm({ ...emptyForm, currency: company?.currency || 'USD' });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      sku: p.sku || '',
      barcode: p.barcode || '',
      description: p.description || '',
      product_type: p.product_type,
      unit_price: p.unit_price,
      cost_price: p.cost_price,
      currency: p.currency,
      unit_of_measure: p.unit_of_measure,
      is_taxable: p.is_taxable,
      tax_rate: Number(p.tax_rate) * 100,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!company) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        barcode: form.barcode.trim() || null,
        tax_rate: form.is_taxable ? form.tax_rate / 100 : 0,
        company_id: company.id,
      };
      let res: Response;
      if (editProduct) {
        res = await fetch(`/api/products/${editProduct.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/products', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      toast.success(editProduct ? 'Product updated' : 'Product created');
      setShowModal(false);
      loadProducts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Product deleted');
      loadProducts();
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const handleToggleActive = async (p: Product) => {
    try {
      await fetch(`/api/products/${p.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      loadProducts();
    } catch {
      toast.error('Failed to update');
    }
  };

  // Scan to register
  const openScanModal = () => {
    setScanValue('');
    setScanResult(null);
    setShowScanModal(true);
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  const handleScanLookup = useCallback(async (barcode: string) => {
    if (!barcode.trim() || !company) return;
    setScanning(true);
    try {
      const res = await fetch(
        `/api/products?company_id=${company.id}&barcode=${encodeURIComponent(barcode.trim())}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      setScanResult({ found: !!data.data, product: data.data || undefined });
    } catch {
      toast.error('Lookup failed');
    } finally {
      setScanning(false);
    }
  }, [company]);

  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScanLookup(scanValue);
    }
  };

  const assignBarcodeToExisting = (product: Product) => {
    setShowScanModal(false);
    openEdit(product);
    setForm(f => ({ ...f, barcode: scanValue.trim() }));
  };

  const createWithBarcode = () => {
    setShowScanModal(false);
    openCreate();
    setForm(f => ({ ...f, barcode: scanValue.trim() }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CubeIcon className="w-7 h-7 text-blueox-primary" />
              Price List
            </h1>
            <p className="text-gray-500 mt-1">Products, services and non-inventory items you sell — added to invoices and receipts</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openScanModal} className="btn-secondary flex items-center gap-2">
              <QrCodeIcon className="w-5 h-5" />
              Scan Barcode
            </button>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <PlusIcon className="w-5 h-5" />
              New Product
            </button>
          </div>
        </div>

        {/* Inventory module banner */}
        {hasInventory ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-sm text-green-800">
              <span className="font-semibold">Stock Control is active.</span> Track quantities, adjustments, locations and more.
            </p>
            <Link href="/dashboard/inventory" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-900 transition-colors">
              Go to Inventory <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Want stock control?</span> Enable the Inventory module to track quantities, reorder points, stock adjustments and more.
            </p>
            <Link href="/dashboard/billing/add-modules" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900 transition-colors">
              Enable Inventory <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white/90 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center">
              <CubeIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Price list is empty</p>
              <p className="text-sm text-gray-400 mt-1">Add products, services, or non-inventory items to use on invoices and receipts</p>
              <button onClick={openCreate} className="btn-primary mt-4">
                <PlusIcon className="w-4 h-4 mr-1" /> Add Product
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">SKU / Barcode</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Unit Price</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Tax</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.sku && <p>{p.sku}</p>}
                      {p.barcode && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <QrCodeIcon className="w-3 h-3" />{p.barcode}
                        </p>
                      )}
                      {!p.sku && !p.barcode && '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.product_type === 'service'
                          ? 'bg-blue-100 text-blue-700'
                          : p.product_type === 'inventory'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {p.product_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {p.currency} {Number(p.unit_price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.is_taxable ? (
                        <span className="text-green-700 font-medium">{(Number(p.tax_rate) * 100).toFixed(1)}%</span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(p)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {p.is_active ? <CheckIcon className="w-3 h-3" /> : <XMarkIcon className="w-3 h-3" />}
                        {p.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {hasInventory && p.product_type === 'inventory' && (
                          <Link
                            href={`/dashboard/inventory/${p.id}`}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                            title="View stock"
                          >
                            <CubeIcon className="w-4 h-4" />
                          </Link>
                        )}
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm lg:pl-64">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {editProduct ? 'Edit Product' : 'New Product / Service'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  placeholder="e.g. Web Design Service"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* SKU + Barcode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">SKU / Code</label>
                  <input
                    className="input"
                    placeholder="Optional"
                    value={form.sku}
                    onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Barcode</label>
                  <input
                    className="input"
                    placeholder="Scan or type barcode"
                    value={form.barcode}
                    onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                  />
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={form.product_type}
                  onChange={e => setForm(f => ({ ...f, product_type: e.target.value }))}
                >
                  <option value="service">Service</option>
                  <option value="inventory">Inventory Item</option>
                  <option value="non_inventory">Non-Inventory</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-[70px]"
                  placeholder="Brief description shown on invoices"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Price + Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Unit Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    value={form.unit_price}
                    onChange={e => setForm(f => ({ ...f, unit_price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <select
                    className="input"
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  >
                    <option value="USD">USD</option>
                    <option value="UGX">UGX</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              {/* Unit of measure */}
              <div>
                <label className="label">Unit of Measure</label>
                <select
                  className="input"
                  value={form.unit_of_measure}
                  onChange={e => setForm(f => ({ ...f, unit_of_measure: e.target.value }))}
                >
                  <option value="each">Each</option>
                  <option value="hour">Hour</option>
                  <option value="day">Day</option>
                  <option value="month">Month</option>
                  <option value="kg">Kg</option>
                  <option value="litre">Litre</option>
                  <option value="box">Box</option>
                </select>
              </div>

              {/* Tax */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Taxable</label>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_taxable: !f.is_taxable }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.is_taxable ? 'bg-blueox-primary' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.is_taxable ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                {form.is_taxable && (
                  <div>
                    <label className="label">Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="input"
                      placeholder="e.g. 18 for 18%"
                      value={form.tax_rate}
                      onChange={e => setForm(f => ({ ...f, tax_rate: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editProduct ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan to Register Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm lg:pl-64">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <QrCodeIcon className="w-5 h-5 text-blueox-primary" />
                Scan to Register
              </h2>
              <button onClick={() => setShowScanModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Scan a barcode with your scanner, or type it manually, then press Enter to look it up.
              </p>
              <div className="flex gap-2">
                <input
                  ref={scanInputRef}
                  className="input flex-1"
                  placeholder="Scan or type barcode..."
                  value={scanValue}
                  onChange={e => { setScanValue(e.target.value); setScanResult(null); }}
                  onKeyDown={handleScanKeyDown}
                  autoComplete="off"
                />
                <button
                  onClick={() => handleScanLookup(scanValue)}
                  disabled={scanning || !scanValue.trim()}
                  className="btn-primary px-4"
                >
                  {scanning ? '...' : 'Look up'}
                </button>
              </div>

              {scanResult && (
                <div className={`rounded-xl p-4 ${scanResult.found ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                  {scanResult.found && scanResult.product ? (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-green-800">
                        Product found: <span className="font-bold">{scanResult.product.name}</span>
                      </p>
                      <p className="text-xs text-green-700">
                        This product already has this barcode assigned. You can edit the product to update any details.
                      </p>
                      <button
                        onClick={() => { setShowScanModal(false); openEdit(scanResult.product!); }}
                        className="btn-secondary text-sm w-full"
                      >
                        Edit {scanResult.product.name}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-amber-800">
                        No product found for barcode: <span className="font-mono">{scanValue}</span>
                      </p>
                      <p className="text-xs text-amber-700">
                        Assign this barcode to an existing product, or create a new product with it.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={createWithBarcode}
                          className="btn-primary text-sm"
                        >
                          Create New Product
                        </button>
                        <div className="relative group">
                          <select
                            className="input text-sm w-full"
                            defaultValue=""
                            onChange={e => {
                              const product = products.find(p => p.id === e.target.value);
                              if (product) assignBarcodeToExisting(product);
                            }}
                          >
                            <option value="" disabled>Assign to existing…</option>
                            {products.filter(p => p.is_active).map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
