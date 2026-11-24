'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { confirmDialog } from '@/components/confirm-dialog';
import { Combobox } from '@/components/ui/combobox';
import { NumberInput } from '@/components/ui/number-input';
import { DatePicker } from '@/components/ui/date-picker';
import { PRICING, type Region } from '@/lib/regional-pricing';

interface CompanyRow {
  id: string;
  name: string;
  country: string | null;
  region: Region | null;
  subscription_plan: string | null;
  subscription_status: string | null;
}

interface Overview {
  company: { id: string; name: string; country: string | null; region: Region };
  subscription: {
    plan_tier: string; billing_period: string; status: string;
    current_period_start: string; current_period_end: string;
    base_price_amount: string; currency: string;
  } | null;
  modules: { id: string; name: string; active: boolean; price: number; currency: string }[];
}

const PLAN_TIERS: Array<'starter' | 'professional' | 'enterprise'> = ['starter', 'professional', 'enterprise'];
const today = () => new Date().toISOString().slice(0, 10);

// Platform admins only: record an offline payment (activate or renew, possibly on a
// different plan), change a company's plan tier with no payment, or toggle an add-on
// module, without hand-writing SQL each time. Mirrors LegacyPlansSection's pattern.
export default function ManageCompanySection() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [payment, setPayment] = useState({
    plan_tier: 'starter' as (typeof PLAN_TIERS)[number],
    billing_period: 'monthly' as 'monthly' | 'annual',
    amount: 0,
    currency: 'USD',
    purchase_date: today(),
    note: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);

  const [newPlanTier, setNewPlanTier] = useState<(typeof PLAN_TIERS)[number]>('starter');
  const [savingPlan, setSavingPlan] = useState(false);
  const [togglingModule, setTogglingModule] = useState<string | null>(null);

  const loadCompanies = useCallback(async () => {
    const res = await fetch('/api/admin/companies', { credentials: 'include' });
    if (res.status === 403) { setForbidden(true); return; }
    const data = await res.json().catch(() => ({}));
    setCompanies(data.data || []);
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const loadOverview = useCallback(async (id: string) => {
    if (!id) { setOverview(null); return; }
    setLoadingOverview(true);
    try {
      const res = await fetch(`/api/admin/company-overview?company_id=${id}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOverview(data.data);
      const tier: (typeof PLAN_TIERS)[number] = data.data.subscription?.plan_tier || 'starter';
      setNewPlanTier(tier);
      const region: Region = data.data.company.region;
      const price = PRICING[tier][region];
      setPayment((p) => ({ ...p, plan_tier: tier, currency: price.currency, amount: price.monthly }));
    } catch (e: any) {
      toast.error(e.message || 'Failed to load that company');
      setOverview(null);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const pickCompany = (id: string) => {
    setCompanyId(id);
    loadOverview(id);
  };

  // Auto-fill price/currency from the regional pricing table whenever plan or period change,
  // but only when the admin hasn't already typed a different number for this exact combo -
  // simplest is to just always recompute; an admin wanting a negotiated price edits the
  // amount field afterwards, same as every manual SQL script this session has done by hand.
  const applyRegionalPrice = (tier: typeof payment.plan_tier, period: typeof payment.billing_period) => {
    if (!overview) return;
    const price = PRICING[tier][overview.company.region];
    const amount = period === 'annual' ? price.annually * 12 : price.monthly;
    setPayment((p) => ({ ...p, plan_tier: tier, billing_period: period, currency: price.currency, amount }));
  };

  const recordPayment = async () => {
    if (!companyId) return;
    setSavingPayment(true);
    try {
      const res = await fetch('/api/admin/record-payment', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, ...payment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Payment recorded');
      loadOverview(companyId);
    } catch (e: any) {
      toast.error(e.message || 'Failed to record payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const changePlan = async () => {
    if (!companyId) return;
    setSavingPlan(true);
    try {
      const res = await fetch('/api/admin/change-plan', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, plan_tier: newPlanTier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Plan changed');
      loadOverview(companyId);
    } catch (e: any) {
      toast.error(e.message || 'Failed to change plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const toggleModule = async (moduleId: string, nextActive: boolean) => {
    if (!nextActive) {
      const mod = overview?.modules.find((m) => m.id === moduleId);
      if (!(await confirmDialog(`Turn off ${mod?.name || moduleId} for ${overview?.company.name}?`))) return;
    }
    setTogglingModule(moduleId);
    try {
      const res = await fetch('/api/admin/modules', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, module_id: moduleId, action: nextActive ? 'activate' : 'deactivate' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(nextActive ? 'Module turned on' : 'Module turned off');
      loadOverview(companyId);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update that module');
    } finally {
      setTogglingModule(null);
    }
  };

  if (forbidden) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Manage company</h2>
        <p className="text-sm text-gray-600">Record an offline payment, change a plan, or toggle a module, for one company.</p>
      </div>

      <div className="max-w-md">
        <Combobox
          label="Company"
          placeholder="Choose a company…"
          options={companies.map((c) => ({ value: c.id, label: c.name, description: c.subscription_plan || undefined }))}
          value={companyId}
          onChange={pickCompany}
        />
      </div>

      {loadingOverview && <p className="text-sm text-gray-500">Loading…</p>}

      {overview && !loadingOverview && (
        <div className="space-y-6">
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            Current: <span className="font-medium text-gray-900">
              {overview.subscription ? `${overview.subscription.plan_tier} · ${overview.subscription.billing_period} · ${overview.subscription.status}` : 'No subscription yet (trial)'}
            </span>
            {overview.subscription && (
              <> · renews {new Date(overview.subscription.current_period_end).toLocaleDateString()}</>
            )}
          </div>

          {/* Record a payment */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Record a payment</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select className="w-full border rounded-lg px-3 py-2" value={payment.plan_tier}
                  onChange={(e) => applyRegionalPrice(e.target.value as any, payment.billing_period)}>
                  {PLAN_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing period</label>
                <select className="w-full border rounded-lg px-3 py-2" value={payment.billing_period}
                  onChange={(e) => applyRegionalPrice(payment.plan_tier, e.target.value as any)}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual (full year total)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({payment.currency})</label>
                <NumberInput value={payment.amount} onChange={(v) => setPayment((p) => ({ ...p, amount: v }))} min={0} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase date</label>
                <DatePicker value={payment.purchase_date} onChange={(d) => setPayment((p) => ({ ...p, purchase_date: d ? d.toISOString().slice(0, 10) : today() }))} />
              </div>
            </div>
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Note (optional), e.g. paid via mobile money, ref 123"
              value={payment.note} onChange={(e) => setPayment((p) => ({ ...p, note: e.target.value }))} />
            <button onClick={recordPayment} disabled={savingPayment} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold disabled:opacity-50">
              {savingPayment ? 'Recording…' : 'Record Payment'}
            </button>
          </div>

          {/* Change plan, no payment */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Change plan</h3>
            <p className="text-xs text-gray-500">No payment is recorded; billing period and renewal date stay as they are.</p>
            <div className="flex items-end gap-3">
              <select className="border rounded-lg px-3 py-2" value={newPlanTier} onChange={(e) => setNewPlanTier(e.target.value as any)}>
                {PLAN_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={changePlan} disabled={savingPlan} className="bg-gray-700 text-white px-5 py-2 rounded-lg font-semibold disabled:opacity-50">
                {savingPlan ? 'Changing…' : 'Change Plan'}
              </button>
            </div>
          </div>

          {/* Modules */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-gray-900">Modules</h3>
            <div className="divide-y">
              {overview.modules.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.currency} {m.price.toLocaleString()}/month</p>
                  </div>
                  <button
                    onClick={() => toggleModule(m.id, !m.active)}
                    disabled={togglingModule === m.id}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 ${m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {togglingModule === m.id ? '…' : m.active ? 'On' : 'Off'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
