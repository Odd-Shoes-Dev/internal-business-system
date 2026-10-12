'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { DEFAULT_POS_SETTINGS, type PosSettings } from '@/lib/pos/settings';
import RestaurantTablesManager from './restaurant-tables-manager';

interface WhatsAppForm {
  enabled: boolean;
  phone_number_id: string;
  template_name: string;
  template_language: string;
  default_country_code: string;
  has_access_token: boolean;
  encryption_configured: boolean;
}

const EMPTY_WHATSAPP: WhatsAppForm = {
  enabled: false,
  phone_number_id: '',
  template_name: 'order_confirmation',
  template_language: 'en',
  default_country_code: '256',
  has_access_token: false,
  encryption_configured: true,
};

export default function PosSettingsTab({ companyId, currency }: { companyId: string; currency: string }) {
  const [settings, setSettings] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [whatsapp, setWhatsapp] = useState<WhatsAppForm>(EMPTY_WHATSAPP);
  const [accessToken, setAccessToken] = useState('');
  const [testNumber, setTestNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingPos, setSavingPos] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [posRes, waRes] = await Promise.all([
          fetch(`/api/companies/pos-settings?company_id=${companyId}`, { credentials: 'include' }),
          fetch(`/api/companies/whatsapp?company_id=${companyId}`, { credentials: 'include' }),
        ]);
        if (posRes.ok) setSettings((await posRes.json()).data);
        if (waRes.ok) setWhatsapp((await waRes.json()).data);
      } catch {
        toast.error('Failed to load POS settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  const setLoyalty = (patch: Partial<PosSettings['loyalty']>) =>
    setSettings((s) => ({ ...s, loyalty: { ...s.loyalty, ...patch } }));

  const savePos = async () => {
    setSavingPos(true);
    try {
      const res = await fetch('/api/companies/pos-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data.data);
      toast.success('POS settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSavingPos(false);
    }
  };

  const saveWhatsapp = async () => {
    setSavingWhatsapp(true);
    try {
      const res = await fetch('/api/companies/whatsapp', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, ...whatsapp, access_token: accessToken || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (accessToken) setWhatsapp((w) => ({ ...w, has_access_token: true }));
      setAccessToken('');
      toast.success('WhatsApp settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/companies/whatsapp/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, to: testNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
    } catch (e: any) {
      toast.error(e.message || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading POS settings...</div>;
  }

  const { loyalty } = settings;

  return (
    <div className="divide-y divide-gray-100">
      <div className="px-8 py-6">
        <h2 className="text-xl font-bold text-black">Point of Sale</h2>
        <p className="text-sm text-gray-500 mt-1">Receipt text, loyalty points and WhatsApp order confirmations for the till.</p>
      </div>

      {/* Restaurant */}
      <section className="px-8 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Restaurant mode</h3>
            <p className="text-sm text-gray-600">Tables at the till: open orders per table, kitchen tickets, moving tables and splitting bills.</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={settings.restaurant_mode}
              onChange={(e) => setSettings((s) => ({ ...s, restaurant_mode: e.target.checked }))} />
            Enabled
          </label>
        </div>
        {settings.restaurant_mode && <RestaurantTablesManager companyId={companyId} />}
        <p className="text-xs text-gray-500">Save below to switch restaurant mode on or off; tables are saved as you edit them.</p>
      </section>

      {/* Receipt */}
      <section className="px-8 py-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Receipt</h3>
        <div>
          <label className="label">Header text</label>
          <textarea
            className="input min-h-[70px]"
            maxLength={500}
            placeholder="Shown under your company name, e.g. a slogan or TIN"
            value={settings.receipt_header}
            onChange={(e) => setSettings((s) => ({ ...s, receipt_header: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Footer text</label>
          <textarea
            className="input min-h-[70px]"
            maxLength={500}
            placeholder="e.g. Thank you! Goods once sold are not returnable."
            value={settings.receipt_footer}
            onChange={(e) => setSettings((s) => ({ ...s, receipt_footer: e.target.value }))}
          />
        </div>
      </section>

      {/* Loyalty */}
      <section className="px-8 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Loyalty points</h3>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={loyalty.enabled} onChange={(e) => setLoyalty({ enabled: e.target.checked })} />
            Enabled
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Spend per point ({currency})</label>
            <input type="number" min="0" step="any" className="input" disabled={!loyalty.enabled}
              value={loyalty.amount_per_point}
              onChange={(e) => setLoyalty({ amount_per_point: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Value of 1 point ({currency})</label>
            <input type="number" min="0" step="any" className="input" disabled={!loyalty.enabled}
              value={loyalty.point_value}
              onChange={(e) => setLoyalty({ point_value: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Minimum points to redeem</label>
            <input type="number" min="0" step="1" className="input" disabled={!loyalty.enabled}
              value={loyalty.min_redeem_points}
              onChange={(e) => setLoyalty({ min_redeem_points: Number(e.target.value) })} />
          </div>
        </div>
        {loyalty.enabled && loyalty.amount_per_point > 0 && (
          <p className="text-sm text-gray-600">
            A customer who spends {currency} {(loyalty.amount_per_point * 100).toLocaleString()} earns 100 points,
            worth {currency} {(loyalty.point_value * 100).toLocaleString()} off a later purchase
            ({((loyalty.point_value / loyalty.amount_per_point) * 100).toFixed(2)}% back).
          </p>
        )}
        <div className="flex justify-end">
          <button onClick={savePos} disabled={savingPos} className="btn-primary">
            {savingPos ? 'Saving...' : 'Save restaurant, receipt & loyalty'}
          </button>
        </div>
      </section>

      {/* WhatsApp */}
      <section className="px-8 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">WhatsApp order confirmations</h3>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={whatsapp.enabled} onChange={(e) => setWhatsapp((w) => ({ ...w, enabled: e.target.checked }))} />
            Enabled
          </label>
        </div>
        <p className="text-sm text-gray-600">
          Connect your company&apos;s own WhatsApp Business number (Meta Cloud API). After each till sale to a customer
          with a WhatsApp number, they get your approved template with: {'{{1}}'} their name, {'{{2}}'} the amount paid,
          {' {{3}}'} the items bought.
        </p>
        {!whatsapp.encryption_configured && (
          <p className="text-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
            The server has no APP_ENCRYPTION_KEY set, so an access token cannot be saved yet.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Phone number ID</label>
            <input className="input" placeholder="From Meta: WhatsApp > API Setup"
              value={whatsapp.phone_number_id}
              onChange={(e) => setWhatsapp((w) => ({ ...w, phone_number_id: e.target.value }))} />
          </div>
          <div>
            <label className="label">Access token {whatsapp.has_access_token && <span className="text-green-700">(saved)</span>}</label>
            <input type="password" className="input" autoComplete="off"
              placeholder={whatsapp.has_access_token ? 'Leave blank to keep the saved token' : 'Permanent access token'}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)} />
          </div>
          <div>
            <label className="label">Template name</label>
            <input className="input" value={whatsapp.template_name}
              onChange={(e) => setWhatsapp((w) => ({ ...w, template_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Template language</label>
              <input className="input" value={whatsapp.template_language}
                onChange={(e) => setWhatsapp((w) => ({ ...w, template_language: e.target.value }))} />
            </div>
            <div>
              <label className="label">Default country code</label>
              <input className="input" value={whatsapp.default_country_code}
                onChange={(e) => setWhatsapp((w) => ({ ...w, default_country_code: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-2">
            <div>
              <label className="label">Send a test to</label>
              <input className="input" placeholder="0772 123456" value={testNumber} onChange={(e) => setTestNumber(e.target.value)} />
            </div>
            <button onClick={sendTest} disabled={testing || !testNumber} className="btn-secondary">
              {testing ? 'Sending...' : 'Send test'}
            </button>
          </div>
          <button onClick={saveWhatsapp} disabled={savingWhatsapp} className="btn-primary">
            {savingWhatsapp ? 'Saving...' : 'Save WhatsApp settings'}
          </button>
        </div>
      </section>
    </div>
  );
}
