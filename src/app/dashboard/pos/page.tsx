'use client';

import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/company-context';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCartIcon,
  PlusIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/currency';

interface Terminal {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  open_session_id: string | null;
  opened_at: string | null;
  cashier_name: string | null;
  total_sales: number | null;
  transaction_count: number | null;
}

interface Session {
  id: string;
  terminal_name: string;
  opened_by_name: string;
  closed_by_name: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  total_sales: number;
  transaction_count: number;
  status: string;
  currency: string;
  variance: number | null;
}

export default function POSManagerPage() {
  const { company } = useCompany();
  const router = useRouter();

  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // New terminal modal
  const [showNewTerminal, setShowNewTerminal] = useState(false);
  const [terminalName, setTerminalName] = useState('');
  const [terminalDesc, setTerminalDesc] = useState('');
  const [savingTerminal, setSavingTerminal] = useState(false);

  // Open session modal
  const [openingTerminal, setOpeningTerminal] = useState<Terminal | null>(null);
  const [openingFloat, setOpeningFloat] = useState('0');
  const [openingSession, setOpeningSession] = useState(false);

  useEffect(() => {
    if (company) loadAll();
  }, [company]);

  const loadAll = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        fetch(`/api/pos/terminals?company_id=${company.id}`, { credentials: 'include' }),
        fetch(`/api/pos/sessions?company_id=${company.id}&limit=20`, { credentials: 'include' }),
      ]);
      const tData = await tRes.json();
      const sData = await sRes.json();
      setTerminals(tData.data || []);
      setSessions(sData.data || []);
    } catch {
      toast.error('Failed to load POS data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTerminal = async () => {
    if (!terminalName.trim() || !company) return;
    setSavingTerminal(true);
    try {
      const res = await fetch('/api/pos/terminals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.id, name: terminalName.trim(), description: terminalDesc.trim() || null }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast.success('Terminal created');
      setShowNewTerminal(false);
      setTerminalName('');
      setTerminalDesc('');
      loadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingTerminal(false);
    }
  };

  const handleOpenSession = async () => {
    if (!openingTerminal || !company) return;
    setOpeningSession(true);
    try {
      const res = await fetch('/api/pos/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          terminal_id: openingTerminal.id,
          opening_float: parseFloat(openingFloat) || 0,
          currency: company.currency || 'UGX',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Session opened — launching till');
      router.push(`/pos/session/${data.data.id}`);
    } catch (e: any) {
      toast.error(e.message);
      setOpeningSession(false);
    }
  };

  const todaySales = sessions
    .filter(s => s.opened_at && new Date(s.opened_at).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + Number(s.total_sales || 0), 0);

  const todayTxCount = sessions
    .filter(s => s.opened_at && new Date(s.opened_at).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + Number(s.transaction_count || 0), 0);

  const currency = company?.currency || 'UGX';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 flex items-center justify-center">
        <p className="text-gray-400">Loading POS...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCartIcon className="w-7 h-7 text-blueox-primary" />
              Point of Sale
            </h1>
            <p className="text-gray-500 mt-1">Manage terminals, open shifts, and view sales history</p>
          </div>
          <button onClick={() => setShowNewTerminal(true)} className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
            Add Terminal
          </button>
        </div>

        {/* Today's summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/90 rounded-2xl border border-blueox-primary/20 shadow p-5">
            <p className="text-sm text-gray-500">Today&apos;s Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(todaySales, currency)}</p>
          </div>
          <div className="bg-white/90 rounded-2xl border border-blueox-primary/20 shadow p-5">
            <p className="text-sm text-gray-500">Today&apos;s Transactions</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{todayTxCount}</p>
          </div>
        </div>

        {/* Terminals */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Terminals</h2>
          {terminals.length === 0 ? (
            <div className="bg-white/90 rounded-2xl border border-blueox-primary/20 shadow p-10 text-center">
              <ComputerDesktopIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No terminals yet</p>
              <p className="text-sm text-gray-400 mt-1">Add a terminal to represent a physical till device</p>
              <button onClick={() => setShowNewTerminal(true)} className="btn-primary mt-4">
                <PlusIcon className="w-4 h-4 mr-1" /> Add Terminal
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {terminals.map(t => (
                <div
                  key={t.id}
                  className="bg-white/90 rounded-2xl border border-blueox-primary/20 shadow p-5 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{t.name}</p>
                      {t.description && <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>}
                    </div>
                    {t.open_session_id ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        Closed
                      </span>
                    )}
                  </div>

                  {t.open_session_id ? (
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <p>Cashier: <span className="font-medium text-gray-700">{t.cashier_name || '—'}</span></p>
                      <p>Sales: <span className="font-medium text-gray-700">{formatCurrency(Number(t.total_sales || 0), currency)}</span></p>
                      <p>Transactions: <span className="font-medium text-gray-700">{t.transaction_count || 0}</span></p>
                    </div>
                  ) : null}

                  {t.open_session_id ? (
                    <Link
                      href={`/pos/session/${t.open_session_id}`}
                      className="btn-primary text-sm w-full flex items-center justify-center gap-2"
                    >
                      <ShoppingCartIcon className="w-4 h-4" />
                      Go to Till
                    </Link>
                  ) : (
                    <button
                      onClick={() => { setOpeningTerminal(t); setOpeningFloat('0'); }}
                      className="btn-secondary text-sm w-full flex items-center justify-center gap-2"
                    >
                      <ClockIcon className="w-4 h-4" />
                      Open Shift
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shift history */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Shifts</h2>
          <div className="bg-white/90 rounded-2xl border border-blueox-primary/20 shadow overflow-hidden">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No shifts yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Terminal</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Cashier</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Opened</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Closed</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Sales</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Txns</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Variance</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sessions.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.terminal_name}</td>
                      <td className="px-4 py-3 text-gray-500">{s.opened_by_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(s.opened_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {s.closed_at ? new Date(s.closed_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(Number(s.total_sales || 0), s.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{s.transaction_count}</td>
                      <td className="px-4 py-3 text-center">
                        {s.variance != null ? (
                          <span className={`text-xs font-medium ${Number(s.variance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {Number(s.variance) >= 0 ? '+' : ''}{formatCurrency(Math.abs(Number(s.variance)), s.currency)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.status === 'open' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Open
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            <CheckCircleIcon className="w-3 h-3" />
                            Closed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* New terminal modal */}
      {showNewTerminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm lg:pl-64">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">New Terminal</h2>
              <button onClick={() => setShowNewTerminal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Terminal Name *</label>
                <input
                  className="input"
                  placeholder="e.g. Till 1, Front Counter, Cafe Bar"
                  value={terminalName}
                  onChange={e => setTerminalName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateTerminal()}
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Description</label>
                <input
                  className="input"
                  placeholder="Optional notes"
                  value={terminalDesc}
                  onChange={e => setTerminalDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowNewTerminal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreateTerminal} disabled={savingTerminal || !terminalName.trim()} className="btn-primary">
                {savingTerminal ? 'Creating...' : 'Create Terminal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open session modal */}
      {openingTerminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm lg:pl-64">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">Open Shift — {openingTerminal.name}</h2>
              <button onClick={() => setOpeningTerminal(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Opening Float ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  placeholder="Cash in drawer at shift start"
                  value={openingFloat}
                  onChange={e => setOpeningFloat(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">Enter the amount of cash already in the till drawer before any sales</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setOpeningTerminal(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleOpenSession} disabled={openingSession} className="btn-primary flex items-center gap-2">
                <CurrencyDollarIcon className="w-4 h-4" />
                {openingSession ? 'Opening...' : 'Open & Go to Till'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
