'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { PlusIcon, Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/currency';

interface ParentProduct {
  id: string;
  name: string;
  sku: string | null;
  unit_price: number | string;
  cost_price: number | string;
  currency: string;
  unit_of_measure: string;
  category_id: string | null;
  is_taxable: boolean;
}

interface Variant {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_price: string;
  quantity_on_hand: string;
  unit_of_measure: string;
  variant_attributes: Record<string, string> | null;
  is_active: boolean;
}

// Variants are products of their own (own SKU, barcode, price and stock) linked to this one.
export default function VariantsSection({ parent, companyId }: { parent: ParentProduct; companyId: string }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attributes, setAttributes] = useState<Array<{ name: string; value: string }>>([{ name: 'Size', value: '' }]);
  const [form, setForm] = useState({ sku: '', barcode: '', price: '', cost: '', quantity: '' });

  const load = useCallback(async () => {
    const res = await fetch(`/api/inventory?company_id=${companyId}&parent_id=${parent.id}&limit=200`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    setVariants(data.data || []);
  }, [companyId, parent.id]);

  useEffect(() => { load(); }, [load]);

  const label = attributes.map((a) => a.value.trim()).filter(Boolean).join(' / ');

  const openForm = () => {
    setAttributes([{ name: 'Size', value: '' }]);
    setForm({ sku: '', barcode: '', price: String(parent.unit_price ?? ''), cost: String(parent.cost_price ?? ''), quantity: '' });
    setAdding(true);
  };

  const save = async () => {
    const attrs = Object.fromEntries(attributes.filter((a) => a.name.trim() && a.value.trim()).map((a) => [a.name.trim(), a.value.trim()]));
    if (!Object.keys(attrs).length) {
      toast.error('Give the variant at least one attribute, e.g. Size: Large');
      return;
    }
    setSaving(true);
    try {
      const suffix = Object.values(attrs).join('-').toUpperCase().replace(/[^A-Z0-9-]+/g, '');
      const res = await fetch(`/api/inventory?company_id=${companyId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_product_id: parent.id,
          variant_attributes: attrs,
          name: `${parent.name} - ${Object.values(attrs).join(' / ')}`,
          sku: form.sku.trim() || `${parent.sku || 'VAR'}-${suffix}`,
          barcode: form.barcode.trim() || null,
          unit_price: Number(form.price) || 0,
          unit_cost: Number(form.cost) || 0,
          quantity_on_hand: Number(form.quantity) || 0,
          currency: parent.currency,
          unit_of_measure: parent.unit_of_measure,
          category_id: parent.category_id,
          is_taxable: parent.is_taxable,
          product_type: 'inventory',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Variant added');
      setAdding(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to add variant');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Squares2X2Icon className="w-5 h-5 text-gray-400" /> Variants
          </h2>
          <button onClick={openForm} className="btn-secondary btn-sm inline-flex items-center gap-1">
            <PlusIcon className="w-4 h-4" /> Add variant
          </button>
        </div>

        {variants.length === 0 ? (
          <p className="text-sm text-gray-500">
            No variants. Add one for each size, colour or style you stock; each gets its own SKU, barcode, price and stock.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 border-b">
              <tr><th className="py-2">Variant</th><th className="py-2">SKU / barcode</th><th className="py-2 text-right">Price</th><th className="py-2 text-right">In stock</th></tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="py-2">
                    <Link href={`/dashboard/inventory/${v.id}`} className="text-blueox-primary hover:underline">
                      {Object.entries(v.variant_attributes || {}).map(([k, val]) => `${k}: ${val}`).join(', ') || v.name}
                    </Link>
                    {!v.is_active && <span className="ml-2 text-xs text-gray-400">inactive</span>}
                  </td>
                  <td className="py-2 font-mono text-xs text-gray-600">{[v.sku, v.barcode].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="py-2 text-right">{formatCurrency(Number(v.unit_price), parent.currency as any)}</td>
                  <td className="py-2 text-right">{Number(v.quantity_on_hand)} {v.unit_of_measure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold">New variant of {parent.name}</h3>
              <button onClick={() => setAdding(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="label">Attributes</label>
                {attributes.map((attr, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <input className="input" placeholder="e.g. Size" value={attr.name}
                      onChange={(e) => setAttributes((list) => list.map((a, j) => (j === i ? { ...a, name: e.target.value } : a)))} />
                    <input className="input" placeholder="e.g. Large" value={attr.value}
                      onChange={(e) => setAttributes((list) => list.map((a, j) => (j === i ? { ...a, value: e.target.value } : a)))} />
                  </div>
                ))}
                <button type="button" className="text-xs text-blueox-primary hover:underline"
                  onClick={() => setAttributes((list) => [...list, { name: list.length === 1 ? 'Colour' : '', value: '' }])}>
                  + Another attribute
                </button>
                {label && <p className="text-xs text-gray-500">Will be called “{parent.name} - {label}”</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">SKU</label><input className="input" placeholder="Generated if empty" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                <div><label className="label">Barcode</label><input className="input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
                <div><label className="label">Selling price</label><input type="number" min="0" step="any" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                <div><label className="label">Unit cost</label><input type="number" min="0" step="any" className="input" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
                <div className="col-span-2">
                  <label className="label">Opening stock ({parent.unit_of_measure})</label>
                  <input type="number" min="0" step="any" className="input" placeholder="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setAdding(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Add variant'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
