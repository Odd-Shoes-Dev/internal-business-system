'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { confirmDialog } from '@/components/confirm-dialog';
import { AVAILABLE_MODULES } from '@/lib/modules';

interface CompanyRow {
  id: string;
  name: string;
  subscription_plan: string | null;
  subscription_status: string | null;
  currency: string | null;
  legacy: { monthly_fee: number; currency: string; note: string | null; started_at: string } | null;
  modules: string[];
}

// Platform admins only: put a company on the legacy plan (fixed fee, chosen modules,
// never locked), change it, or end it.
export default function LegacyPlansSection() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState({ company_id: '', monthly_fee: '', currency: 'UGX', note: '', modules: [] as string[] });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/legacy-plan', { credentials: 'include' });
    if (res.status === 403) { setForbidden(true); return; }
    const data = await res.json().catch(() => ({}));
    setCompanies(data.data || []);
    setAvailable(data.available_modules || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pick = (companyId: string) => {
    const c = companies.find((x) => x.id === companyId);
    setForm({
      company_id: companyId,
      monthly_fee: c?.legacy ? String(c.legacy.monthly_fee) : '',
      currency: c?.legacy?.currency || c?.currency || 'UGX',
      note: c?.legacy?.note || '',
      modules: c?.subscription_plan === 'legacy' ? c.modules : available,
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/legacy-plan', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, monthly_fee: Number(form.monthly_fee) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Legacy plan saved');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const end = async (c: CompanyRow) => {
    if (!(await confirmDialog(`End the legacy plan for ${c.name}? The company becomes read-only until it moves to a paid plan.`))) return;
    const res = await fetch(`/api/admin/legacy-plan?company_id=${c.id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) { toast.error((await res.json()).error || 'Failed'); return; }
    toast.success('Legacy plan ended');
    load();
  };

  if (forbidden) return null;
  const legacyCompanies = companies.filter((c) => c.subscription_plan === 'legacy');

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Legacy plans</h2>
        <p className="text-sm text-gray-600">Fixed monthly fee, invoiced by us; never locked by trial or billing checks.</p>
      </div>

      {legacyCompanies.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 border-b">
            <tr><th className="py-2">Company</th><th className="py-2">Fee</th><th className="py-2">Modules</th><th className="py-2">Since</th><th /></tr>
          </thead>
          <tbody>
            {legacyCompanies.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2 font-medium">{c.name}</td>
                <td className="py-2">{c.legacy ? `${c.legacy.currency} ${Number(c.legacy.monthly_fee).toLocaleString()}/month` : '—'}</td>
                <td className="py-2 text-gray-600">{c.modules.map((m) => AVAILABLE_MODULES[m]?.name || m).join(', ')}</td>
                <td className="py-2 text-gray-600">{c.legacy?.started_at ? new Date(c.legacy.started_at).toLocaleDateString() : '—'}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  <button onClick={() => pick(c.id)} className="text-blue-600 hover:underline mr-3">Edit</button>
                  <button onClick={() => end(c)} className="text-red-600 hover:underline">End</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
          <select className="w-full border rounded-lg px-3 py-2" value={form.company_id} onChange={(e) => pick(e.target.value)}>
            <option value="">Choose a company…</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.subscription_plan === 'legacy' ? ' (legacy)' : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monthly fee</label>
          <input type="number" min="0" className="w-full border rounded-lg px-3 py-2" value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <input className="w-full border rounded-lg px-3 py-2 uppercase" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </div>
      </div>
      {form.company_id && (
        <>
          <div className="flex flex-wrap gap-3">
            {available.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.modules.includes(m)}
                  onChange={(e) => setForm({ ...form, modules: e.target.checked ? [...form.modules, m] : form.modules.filter((x) => x !== m) })} />
                {AVAILABLE_MODULES[m]?.name || m}
              </label>
            ))}
          </div>
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Note shown to the company (optional), e.g. invoiced quarterly"
            value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button onClick={save} disabled={saving || form.monthly_fee === ''} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold disabled:opacity-50">
            {saving ? 'Saving…' : 'Save legacy plan'}
          </button>
        </>
      )}
    </div>
  );
}
