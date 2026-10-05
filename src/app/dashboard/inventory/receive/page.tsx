'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency } from '@/lib/currency';
import { PageHeader } from '@/components/page-header';

interface StockProduct {
  id: string;
  name: string;
  sku: string | null;
  unit_of_measure: string;
  purchase_unit: string | null;
  units_per_purchase_unit: string | number;
  cost_price: string | number;
  track_inventory: boolean;
  product_type: string;
}

interface Line {
  key: number;
  product_id: string;
  in_purchase_unit: boolean;
  quantity: string;
  cost: string; // per the chosen unit
  lot_number: string;
  expiry_date: string;
  manufacture_date: string;
}

let nextKey = 1;
const emptyLine = (): Line => ({
  key: nextKey++, product_id: '', in_purchase_unit: false, quantity: '', cost: '', lot_number: '', expiry_date: '', manufacture_date: '',
});

// "Receive stock": goods arriving from a supplier without a purchase order (the old Stock In).
// Each line becomes a batch with its cost, lot and expiry; the receipt is accepted immediately.
export default function ReceiveStockPage() {
  const router = useRouter();
  const { company } = useCompany();
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [vendorId, setVendorId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    fetch(`/api/inventory?company_id=${company.id}&limit=1000`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setProducts((d.data || []).filter((p: StockProduct) => p.track_inventory && p.product_type !== 'service')))
      .catch(() => toast.error('Failed to load products'));
    fetch(`/api/vendors?company_id=${company.id}&limit=500`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setVendors(d.data || []))
      .catch(() => {});
  }, [company?.id]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const describe = (line: Line) => {
    const p = byId.get(line.product_id);
    if (!p) return { factor: 1, stockQty: 0, total: 0, unit: '' };
    const factor = line.in_purchase_unit ? Number(p.units_per_purchase_unit) || 1 : 1;
    const qty = Number(line.quantity) || 0;
    return { factor, stockQty: qty * factor, total: qty * (Number(line.cost) || 0), unit: p.unit_of_measure };
  };
  const grandTotal = lines.reduce((sum, l) => sum + describe(l).total, 0);
  const currency = company?.currency || 'UGX';

  const submit = async () => {
    if (!company) return;
    const ready = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
    if (!ready.length) {
      toast.error('Add at least one product with a quantity');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/goods-receipts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          vendor_id: vendorId || null,
          receipt_date: date,
          notes: notes || null,
          accept_now: true,
          lines: ready.map((l) => {
            const p = byId.get(l.product_id)!;
            const base = { product_id: l.product_id, lot_number: l.lot_number || null, expiry_date: l.expiry_date || null, manufacture_date: l.manufacture_date || null };
            return l.in_purchase_unit
              ? { ...base, purchase_quantity: Number(l.quantity), purchase_unit: p.purchase_unit, units_per_purchase_unit: Number(p.units_per_purchase_unit) || 1, purchase_unit_cost: Number(l.cost) || 0 }
              : { ...base, quantity_received: Number(l.quantity), unit_cost: Number(l.cost) || 0 };
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.receipt_number || 'Receipt'} recorded; stock updated`);
      router.push('/dashboard/inventory');
    } catch (e: any) {
      toast.error(e.message || 'Failed to receive stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader title="Receive Stock" />

      <div className="card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="label">Supplier</label>
          <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Not specified</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date received</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" placeholder="e.g. delivery note number" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 min-w-[220px]">Product</th>
              <th className="px-3 py-2">Quantity</th>
              <th className="px-3 py-2">Cost each</th>
              <th className="px-3 py-2">Lot / batch</th>
              <th className="px-3 py-2">Expiry</th>
              <th className="px-3 py-2">Made</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((line) => {
              const p = byId.get(line.product_id);
              const d = describe(line);
              return (
                <tr key={line.key} className="align-top">
                  <td className="px-3 py-2">
                    <select className="input" value={line.product_id}
                      onChange={(e) => {
                        const product = byId.get(e.target.value);
                        update(line.key, { product_id: e.target.value, in_purchase_unit: false, cost: product ? String(Number(product.cost_price) || '') : '' });
                      }}>
                      <option value="">Choose product...</option>
                      {products.map((prod) => <option key={prod.id} value={prod.id}>{prod.name}{prod.sku ? ` (${prod.sku})` : ''}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <input type="number" min="0" step="any" className="input w-24" value={line.quantity} onChange={(e) => update(line.key, { quantity: e.target.value })} />
                      {p?.purchase_unit ? (
                        <select className="input w-28" value={line.in_purchase_unit ? 'purchase' : 'stock'}
                          onChange={(e) => {
                            const inPurchase = e.target.value === 'purchase';
                            const factor = Number(p.units_per_purchase_unit) || 1;
                            const cost = Number(line.cost) || 0;
                            update(line.key, { in_purchase_unit: inPurchase, cost: cost ? String(inPurchase ? cost * factor : cost / factor) : '' });
                          }}>
                          <option value="stock">{p.unit_of_measure}</option>
                          <option value="purchase">{p.purchase_unit}</option>
                        </select>
                      ) : (
                        <span className="self-center text-gray-500 text-xs">{p?.unit_of_measure}</span>
                      )}
                    </div>
                    {line.in_purchase_unit && d.stockQty > 0 && (
                      <p className="text-xs text-gray-500 mt-1">= {d.stockQty} {d.unit}</p>
                    )}
                  </td>
                  <td className="px-3 py-2"><input type="number" min="0" step="any" className="input w-28" value={line.cost} onChange={(e) => update(line.key, { cost: e.target.value })} /></td>
                  <td className="px-3 py-2"><input className="input w-28" value={line.lot_number} onChange={(e) => update(line.key, { lot_number: e.target.value })} /></td>
                  <td className="px-3 py-2"><input type="date" className="input" value={line.expiry_date} onChange={(e) => update(line.key, { expiry_date: e.target.value })} /></td>
                  <td className="px-3 py-2"><input type="date" className="input" value={line.manufacture_date} onChange={(e) => update(line.key, { manufacture_date: e.target.value })} /></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(d.total, currency as any)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== line.key) : [emptyLine()]))}
                      className="p-1.5 text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-3 border-t">
          <button onClick={() => setLines((ls) => [...ls, emptyLine()])} className="btn-secondary btn-sm inline-flex items-center gap-1">
            <PlusIcon className="w-4 h-4" /> Add line
          </button>
          <p className="text-sm">Total <span className="font-bold">{formatCurrency(grandTotal, currency as any)}</span></p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Ordering ahead? Raise a <Link href="/dashboard/purchase-orders/new" className="text-blueox-primary hover:underline">purchase order</Link> and receive against it instead.
        </p>
        <button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Receive into stock'}</button>
      </div>
    </div>
  );
}
