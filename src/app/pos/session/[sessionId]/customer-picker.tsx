'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon, UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

export interface TillCustomer {
  id: string;
  name: string;
  phone: string | null;
  whatsapp_number: string | null;
  loyalty_points: number;
  current_balance: number;
  credit_limit: number;
}

export function toTillCustomer(row: any): TillCustomer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? null,
    whatsapp_number: row.whatsapp_number ?? null,
    loyalty_points: Number(row.loyalty_points || 0),
    current_balance: Number(row.current_balance || 0),
    credit_limit: Number(row.credit_limit || 0),
  };
}

export default function CustomerPicker({
  companyId,
  onSelect,
  onClose,
}: {
  companyId: string;
  onSelect: (customer: TillCustomer) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<TillCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', whatsapp_number: '' });

  useEffect(() => {
    const term = search.trim();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ company_id: companyId, active: 'true', limit: '10' });
        if (term) params.set('search', term);
        const res = await fetch(`/api/customers?${params}`, { credentials: 'include' });
        const data = await res.json();
        setResults((data.data || []).map(toTillCustomer));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, companyId]);

  const createCustomer = async () => {
    if (!form.name.trim()) {
      toast.error('Enter the customer name');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          whatsapp_number: (form.whatsapp_number || form.phone).trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSelect(toTillCustomer(data.data));
    } catch (e: any) {
      toast.error(e.message || 'Failed to add customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">{creating ? 'New customer' : 'Choose customer'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
        </div>

        {creating ? (
          <div className="p-5 space-y-3">
            <div>
              <label className="label">Name</label>
              <input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">WhatsApp (if different)</label>
              <input className="input" type="tel" value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCreating(false)} className="btn-secondary">Back</button>
              <button onClick={createCustomer} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Add & select'}</button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" autoFocus placeholder="Name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y border rounded-xl">
              {results.map((c) => (
                <button key={c.id} onClick={() => onSelect(c)} className="w-full text-left px-4 py-3 hover:bg-gray-50">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {[c.phone, c.loyalty_points > 0 ? `${c.loyalty_points.toLocaleString()} pts` : null,
                      c.current_balance > 0 ? `owes ${c.current_balance.toLocaleString()}` : null].filter(Boolean).join(' · ') || 'No phone'}
                  </p>
                </button>
              ))}
              {!searching && results.length === 0 && (
                <p className="px-4 py-6 text-sm text-center text-gray-500">No customers found</p>
              )}
            </div>
            <button
              onClick={() => { setCreating(true); setForm({ name: search.trim(), phone: '', whatsapp_number: '' }); }}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <UserPlusIcon className="w-4 h-4" /> New customer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
