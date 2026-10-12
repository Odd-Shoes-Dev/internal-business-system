'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { confirmDialog } from '@/components/confirm-dialog';

interface RestaurantTable { id: string; name: string; area: string | null; seats: number | null; order_id: string | null }

// Add, rename and remove the tables shown on the till's floor plan
export default function RestaurantTablesManager({ companyId }: { companyId: string }) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [form, setForm] = useState({ name: '', area: '', seats: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/pos/tables?company_id=${companyId}`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    setTables(data.data || []);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/pos/tables', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, name: form.name, area: form.area, seats: Number(form.seats) || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ name: '', area: form.area, seats: form.seats });
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to add table');
    } finally {
      setSaving(false);
    }
  };

  const update = async (table: RestaurantTable, patch: Partial<RestaurantTable>) => {
    const res = await fetch(`/api/pos/tables/${table.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    if (!res.ok) toast.error((await res.json()).error || 'Failed to save');
    load();
  };

  const remove = async (table: RestaurantTable) => {
    if (!(await confirmDialog(`Remove ${table.name} from the floor plan?`))) return;
    const res = await fetch(`/api/pos/tables/${table.id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) toast.error((await res.json()).error || 'Failed to remove');
    load();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input className="input" placeholder="Table name, e.g. T1" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input className="input" placeholder="Area, e.g. Patio" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
        <input className="input" type="number" min="1" placeholder="Seats" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
        <button onClick={add} disabled={saving || !form.name.trim()} className="btn-secondary inline-flex items-center justify-center gap-1">
          <PlusIcon className="w-4 h-4" /> Add table
        </button>
      </div>
      {tables.length > 0 && (
        <div className="divide-y border rounded-xl">
          {tables.map((t) => (
            <div key={t.id} className="grid grid-cols-4 gap-2 items-center px-3 py-2 text-sm">
              <input className="input py-1" defaultValue={t.name} onBlur={(e) => e.target.value !== t.name && update(t, { name: e.target.value })} />
              <input className="input py-1" defaultValue={t.area || ''} placeholder="Area" onBlur={(e) => e.target.value !== (t.area || '') && update(t, { area: e.target.value })} />
              <input className="input py-1" type="number" min="1" defaultValue={t.seats || ''} placeholder="Seats"
                onBlur={(e) => Number(e.target.value || 0) !== (t.seats || 0) && update(t, { seats: Number(e.target.value) || null })} />
              <div className="flex items-center justify-end gap-2">
                {t.order_id && <span className="text-xs text-amber-700">order open</span>}
                <button onClick={() => remove(t)} className="p-1.5 text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
