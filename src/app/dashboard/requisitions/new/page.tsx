'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/company-context';
import toast from 'react-hot-toast';
import { PlusIcon, XMarkIcon, ClipboardDocumentListIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit_of_measure: string;
  quantity_on_hand: number;
}

interface LineDraft {
  product: Product;
  quantity_requested: string;
  remarks: string;
}

export default function NewRequisitionPage() {
  const { company } = useCompany();
  const router = useRouter();

  const [clientName, setClientName] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [requestDate, setRequestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!company || !productQuery.trim()) {
      setProductResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ company_id: company.id, search: productQuery, active: 'true', limit: '10' });
        const res = await fetch(`/api/products?${q}`, { credentials: 'include' });
        const data = await res.json();
        setProductResults(data.data || []);
      } catch {
        // ignore search errors
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [productQuery, company]);

  const addProduct = (product: Product) => {
    if (lines.some(l => l.product.id === product.id)) {
      toast.error('That item is already on this requisition');
      return;
    }
    setLines(prev => [...prev, { product, quantity_requested: '1', remarks: '' }]);
    setProductQuery('');
    setProductResults([]);
    setShowResults(false);
  };

  const removeLine = (productId: string) => {
    setLines(prev => prev.filter(l => l.product.id !== productId));
  };

  const updateLine = (productId: string, field: 'quantity_requested' | 'remarks', value: string) => {
    setLines(prev => prev.map(l => (l.product.id === productId ? { ...l, [field]: value } : l)));
  };

  const handleSave = async () => {
    if (!company) return;
    if (!clientName.trim()) {
      toast.error('Client / delivery-to name is required');
      return;
    }
    if (lines.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    for (const line of lines) {
      if (!(Number(line.quantity_requested) > 0)) {
        toast.error(`Enter a valid quantity for ${line.product.name}`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/requisitions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          client_name: clientName.trim(),
          delivery_location: deliveryLocation.trim() || null,
          request_date: requestDate || null,
          notes: notes.trim() || null,
          lines: lines.map(l => ({
            product_id: l.product.id,
            quantity_requested: Number(l.quantity_requested),
            remarks: l.remarks.trim() || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create requisition');
      toast.success('Requisition created');
      router.push(`/dashboard/requisitions/${data.data.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardDocumentListIcon className="w-7 h-7 text-blueox-primary" />
            New Requisition
          </h1>
          <p className="text-gray-500 mt-1">Fill in what the client requested — you&apos;ll process deliveries against it afterward</p>
        </div>

        <div className="bg-white/90 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-lg p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery To *</label>
              <input
                type="text"
                className="input"
                placeholder="Client or site name"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Location</label>
              <input
                type="text"
                className="input"
                placeholder="Optional"
                value={deliveryLocation}
                onChange={e => setDeliveryLocation(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Request Date</label>
              <input
                type="date"
                className="input"
                value={requestDate}
                onChange={e => setRequestDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              className="input"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Items Requested</h2>
          </div>

          <div className="relative" ref={searchBoxRef}>
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Search products to add..."
              value={productQuery}
              onChange={e => { setProductQuery(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
            />
            {showResults && productResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {productResults.map(p => (
                  <button
                    type="button"
                    key={p.id}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                    onClick={() => addProduct(p)}
                  >
                    <span className="text-gray-800">{p.name}{p.sku ? <span className="text-gray-400"> ({p.sku})</span> : ''}</span>
                    <span className="text-xs text-gray-400">{p.quantity_on_hand} {p.unit_of_measure} in stock</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No items added yet — search above</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Item</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 w-32">Qty Requested</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Remarks</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map(l => (
                    <tr key={l.product.id}>
                      <td className="px-3 py-2 text-gray-800">
                        {l.product.name}
                        <span className="text-xs text-gray-400 block">{l.product.unit_of_measure} · {l.product.quantity_on_hand} in stock</span>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="input"
                          value={l.quantity_requested}
                          onChange={e => updateLine(l.product.id, 'quantity_requested', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          className="input"
                          value={l.remarks}
                          onChange={e => updateLine(l.product.id, 'remarks', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(l.product.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove item"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push('/dashboard/requisitions')}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            disabled={saving}
            onClick={handleSave}
          >
            <PlusIcon className="w-5 h-5" />
            {saving ? 'Creating...' : 'Create Requisition'}
          </button>
        </div>
      </div>
    </div>
  );
}
