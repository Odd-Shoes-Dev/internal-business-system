'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, MagnifyingGlassIcon, PencilIcon, PlusIcon, TagIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCompany } from '@/contexts/company-context';
import { confirmDialog } from '@/components/confirm-dialog';
import { formatCurrency } from '@/lib/currency';
import type { Promotion } from '@/lib/pos/promotions';

interface ProductOption { id: string; name: string; sku: string | null; unit_price: string }

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const emptyForm = () => {
  const start = new Date();
  const end = new Date(start.getTime() + 7 * 24 * 3600 * 1000);
  return {
    id: '' as string,
    name: '',
    type: 'percentage' as Promotion['type'],
    discount_value: '10',
    buy_quantity: '2',
    get_quantity: '1',
    starts_at: toLocalInput(start.toISOString()),
    ends_at: toLocalInput(end.toISOString()),
    is_active: true,
    product_ids: [] as string[],
  };
};

function state(p: Promotion): { label: string; style: string } {
  const now = Date.now();
  if (!p.is_active) return { label: 'Off', style: 'bg-gray-100 text-gray-600' };
  if (new Date(p.ends_at).getTime() <= now) return { label: 'Ended', style: 'bg-gray-100 text-gray-600' };
  if (new Date(p.starts_at).getTime() > now) return { label: 'Scheduled', style: 'bg-blue-100 text-blue-700' };
  return { label: 'Live', style: 'bg-green-100 text-green-700' };
}

export default function PromotionsPage() {
  const { company } = useCompany();
  const currency = (company?.currency || 'UGX') as any;
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [form, setForm] = useState<ReturnType<typeof emptyForm> | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!company?.id) return;
    const res = await fetch(`/api/promotions?company_id=${company.id}`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    setPromotions(data.data || []);
  }, [company?.id]);

  useEffect(() => {
    load();
    if (company?.id) {
      fetch(`/api/inventory?company_id=${company.id}&limit=1000`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setProducts(d.data || []))
        .catch(() => {});
    }
  }, [load, company?.id]);

  const productName = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const filteredProducts = products.filter((p) =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.sku || '').toLowerCase().includes(productSearch.toLowerCase())
  );

  const describe = (p: Promotion) =>
    p.type === 'percentage' ? `${Number(p.discount_value)}% off`
      : p.type === 'fixed' ? `${formatCurrency(Number(p.discount_value), currency)} off each`
        : `Buy ${p.buy_quantity} get ${p.get_quantity} free`;

  const edit = (p: Promotion) => setForm({
    id: p.id, name: p.name, type: p.type, discount_value: String(p.discount_value), buy_quantity: String(p.buy_quantity ?? 2),
    get_quantity: String(p.get_quantity ?? 1), starts_at: toLocalInput(p.starts_at), ends_at: toLocalInput(p.ends_at),
    is_active: p.is_active, product_ids: p.product_ids,
  });

  const save = async () => {
    if (!form || !company) return;
    setSaving(true);
    try {
      const res = await fetch(form.id ? `/api/promotions/${form.id}` : '/api/promotions', {
        method: form.id ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id, name: form.name, type: form.type, discount_value: Number(form.discount_value),
          buy_quantity: Number(form.buy_quantity), get_quantity: Number(form.get_quantity),
          starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString(),
          is_active: form.is_active, product_ids: form.product_ids,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Promotion saved');
      setForm(null);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Promotion) => {
    if (!(await confirmDialog(`Delete the promotion “${p.name}”?`))) return;
    const res = await fetch(`/api/promotions/${p.id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) { toast.error((await res.json()).error || 'Failed'); return; }
    load();
  };

  const toggleProduct = (id: string) =>
    setForm((f) => f && { ...f, product_ids: f.product_ids.includes(id) ? f.product_ids.filter((x) => x !== id) : [...f.product_ids, id] });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/inventory" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeftIcon className="w-5 h-5 text-gray-600" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><TagIcon className="w-6 h-6 text-blueox-primary" /> Promotions</h1>
            <p className="text-gray-600">Discounts applied automatically at the till while they run. The best offer on an item wins.</p>
          </div>
        </div>
        <button onClick={() => { setForm(emptyForm()); setProductSearch(''); }} className="btn-primary inline-flex items-center gap-1">
          <PlusIcon className="w-4 h-4" /> New promotion
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr><th className="px-4 py-3">Promotion</th><th className="px-4 py-3">Offer</th><th className="px-4 py-3">Products</th><th className="px-4 py-3">Runs</th><th className="px-4 py-3">Status</th><th /></tr>
          </thead>
          <tbody className="divide-y">
            {promotions.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No promotions yet</td></tr>}
            {promotions.map((p) => {
              const st = state(p);
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{describe(p)}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {p.product_ids.map((id) => productName.get(id)).filter(Boolean).join(', ') || `${p.product_ids.length} products`}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(p.starts_at).toLocaleDateString()} – {new Date(p.ends_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.style}`}>{st.label}</span></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => edit(p)} className="p-1.5 text-gray-500 hover:text-blueox-primary"><PencilIcon className="w-4 h-4" /></button>
                    <button onClick={() => remove(p)} className="p-1.5 text-gray-500 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">{form.id ? 'Edit promotion' : 'New promotion'}</h2>
              <button onClick={() => setForm(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Name</label>
                  <input className="input" placeholder="e.g. Weekend soda deal" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Promotion['type'] })}>
                    <option value="percentage">Percentage off</option>
                    <option value="fixed">Amount off each unit</option>
                    <option value="buy_x_get_y">Buy X, get Y free</option>
                  </select>
                </div>
                {form.type === 'buy_x_get_y' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label">Buy</label><input type="number" min="1" className="input" value={form.buy_quantity} onChange={(e) => setForm({ ...form, buy_quantity: e.target.value })} /></div>
                    <div><label className="label">Get free</label><input type="number" min="1" className="input" value={form.get_quantity} onChange={(e) => setForm({ ...form, get_quantity: e.target.value })} /></div>
                  </div>
                ) : (
                  <div>
                    <label className="label">{form.type === 'percentage' ? 'Percent off' : `Amount off each (${currency})`}</label>
                    <input type="number" min="0" step="any" className="input" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
                  </div>
                )}
                <div><label className="label">Starts</label><input type="datetime-local" className="input" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><label className="label">Ends</label><input type="datetime-local" className="input" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
              </div>

              <div>
                <label className="label">Products ({form.product_ids.length} chosen)</label>
                <div className="relative mb-2">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input pl-9" placeholder="Search products" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                </div>
                <div className="max-h-56 overflow-y-auto border rounded-xl divide-y">
                  {filteredProducts.slice(0, 200).map((p) => (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={form.product_ids.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                      <span className="flex-1">{p.name}{p.sku ? <span className="text-gray-400"> · {p.sku}</span> : null}</span>
                      <span className="text-gray-500">{formatCurrency(Number(p.unit_price), currency)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setForm(null)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save promotion'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
