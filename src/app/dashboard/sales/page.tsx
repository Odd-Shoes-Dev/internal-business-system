'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  ShoppingBagIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency } from '@/lib/currency';

interface SaleRow {
  id: string;
  invoice_number: string;
  document_type: 'invoice' | 'pos_sale';
  invoice_date: string;
  created_at: string;
  status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  customer_name: string | null;
  terminal_name: string | null;
  cashier_name: string | null;
  payment_methods: string | null;
  refunded: number;
}

interface Summary {
  count: number;
  gross: number;
  discounts: number;
  tax: number;
  total: number;
  paid: number;
  outstanding: number;
  refunded: number;
}

interface SaleDetail extends SaleRow {
  customer_phone: string | null;
  notes: string | null;
  lines: Array<{ id: string; description: string; quantity: number; unit_price: number; discount_amount: number; tax_amount: number; line_total: number }>;
  payments: Array<{ payment_number: string; payment_date: string; payment_method: string; reference_number: string | null; source: string | null; amount: number }>;
  returns: Array<{ return_number: string; created_at: string; refund_method: string; reason: string | null; total: number }>;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', card: 'Card', credit_card: 'Card', mobile_money: 'Mobile money',
  bank_transfer: 'Bank transfer', check: 'Cheque', stripe: 'Online', other: 'Other',
};
const methodLabel = (m: string | null) =>
  (m || '').split(', ').filter(Boolean).map((x) => METHOD_LABELS[x] || x).join(', ') || '—';

const today = () => new Date().toISOString().slice(0, 10);

export default function SalesPage() {
  const { company } = useCompany();
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [source, setSource] = useState('all');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SaleDetail | null>(null);

  const currency = company?.currency || 'UGX';

  const query = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams({ company_id: company?.id || '', source, ...extra });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      return params;
    },
    [company?.id, from, to, source, status, search]
  );

  useEffect(() => {
    if (!company?.id) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/sales?${query({ page: String(page), limit: '50' })}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setRows(data.data);
        setSummary(data.summary);
        setTotalPages(Math.max(1, data.pagination.totalPages));
      } catch (e: any) {
        toast.error(e.message || 'Failed to load sales');
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [company?.id, query, page]);

  useEffect(() => setPage(1), [from, to, source, status, search]);

  const openDetail = async (row: SaleRow) => {
    try {
      const res = await fetch(`/api/sales/${row.id}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetail({ ...row, ...data.data });
    } catch (e: any) {
      toast.error(e.message || 'Failed to load sale');
    }
  };

  const cards = summary
    ? [
        { label: 'Sales', value: summary.count.toLocaleString() },
        { label: 'Total sales', value: formatCurrency(summary.total, currency) },
        { label: 'Discounts', value: formatCurrency(summary.discounts, currency) },
        { label: 'Tax', value: formatCurrency(summary.tax, currency) },
        { label: 'Collected', value: formatCurrency(summary.paid, currency) },
        { label: 'Outstanding', value: formatCurrency(summary.outstanding, currency) },
        { label: 'Refunded', value: formatCurrency(summary.refunded, currency) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBagIcon className="w-7 h-7 text-blueox-primary" /> Sales
          </h1>
          <p className="text-gray-600">Till sales and invoices, with what was collected and what is still owed</p>
        </div>
        <a href={`/api/sales?${query({ format: 'csv' })}`} className="btn-secondary inline-flex items-center gap-2">
          <ArrowDownTrayIcon className="w-4 h-4" /> Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="card p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Source</label>
          <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sales</option>
            <option value="pos">Till (POS)</option>
            <option value="invoice">Invoices</option>
          </select>
        </div>
        <div>
          <label className="label">Payment</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any</option>
            <option value="paid">Fully paid</option>
            <option value="unpaid">Balance owed</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Search</label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Receipt / invoice number or customer" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-lg font-bold text-gray-900 truncate">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Till / cashier</th>
              <th className="px-4 py-3">Paid by</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Loading...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No sales for these filters</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(row)}>
                <td className="px-4 py-3">
                  <span className="font-mono text-blueox-primary">{row.invoice_number}</span>
                  <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {row.document_type === 'pos_sale' ? 'POS' : 'Invoice'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {String(row.invoice_date).slice(0, 10)}
                  {row.document_type === 'pos_sale' && (
                    <span className="text-gray-400"> {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </td>
                <td className="px-4 py-3">{row.customer_name || <span className="text-gray-400">Walk-in</span>}</td>
                <td className="px-4 py-3 text-gray-600">{[row.terminal_name, row.cashier_name].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{methodLabel(row.payment_methods)}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatCurrency(row.total, row.currency)}
                  {row.refunded > 0 && <p className="text-xs text-red-600 font-normal">-{formatCurrency(row.refunded, row.currency)} refunded</p>}
                </td>
                <td className={`px-4 py-3 text-right ${row.balance_due > 0.01 ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}>
                  {row.balance_due > 0.01 ? formatCurrency(row.balance_due, row.currency) : 'Paid'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-end items-center gap-3 text-sm">
          <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {detail && <SaleDetailModal sale={detail} companyName={company?.name || ''} onClose={() => setDetail(null)} />}
    </div>
  );
}

function SaleDetailModal({ sale, companyName, onClose }: { sale: SaleDetail; companyName: string; onClose: () => void }) {
  const c = sale.currency;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 print:bg-white print:p-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto print:shadow-none print:max-h-none">
        <div className="flex items-center justify-between p-5 border-b print:hidden">
          <h2 className="text-lg font-bold">{sale.invoice_number}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div className="hidden print:block text-center">
            <p className="font-bold text-base">{companyName}</p>
            <p className="font-mono text-xs">{sale.invoice_number}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-gray-600">
            <p>Date: <span className="text-gray-900">{new Date(sale.created_at).toLocaleString()}</span></p>
            <p>Customer: <span className="text-gray-900">{sale.customer_name || 'Walk-in'}</span></p>
            {sale.terminal_name && <p>Till: <span className="text-gray-900">{sale.terminal_name}</span></p>}
            {sale.cashier_name && <p>Cashier: <span className="text-gray-900">{sale.cashier_name}</span></p>}
          </div>

          <table className="w-full">
            <thead className="text-xs text-gray-500 border-b">
              <tr><th className="text-left py-1">Item</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Amount</th></tr>
            </thead>
            <tbody>
              {sale.lines.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-1.5">
                    {l.description}
                    {l.discount_amount > 0 && <span className="block text-xs text-gray-500">Discount -{formatCurrency(l.discount_amount, c)}</span>}
                  </td>
                  <td className="py-1.5 text-right">{l.quantity}</td>
                  <td className="py-1.5 text-right">{formatCurrency(l.line_total, c)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 border-t pt-2">
            <Row label="Subtotal" value={formatCurrency(sale.subtotal, c)} />
            {sale.discount_amount > 0 && <Row label="Discounts" value={`-${formatCurrency(sale.discount_amount, c)}`} />}
            {sale.tax_amount > 0 && <Row label="Tax" value={formatCurrency(sale.tax_amount, c)} />}
            <Row label="Total" value={formatCurrency(sale.total, c)} bold />
            <Row label="Paid" value={formatCurrency(sale.amount_paid, c)} />
            {sale.balance_due > 0.01 && <Row label="Balance owed" value={formatCurrency(sale.balance_due, c)} bold />}
          </div>

          {sale.payments.length > 0 && (
            <div>
              <p className="font-semibold mb-1">Payments</p>
              {sale.payments.map((p) => (
                <Row key={p.payment_number}
                  label={`${p.source === 'pos_return' ? 'Return credit' : METHOD_LABELS[p.payment_method] || p.payment_method} · ${String(p.payment_date).slice(0, 10)}${p.reference_number ? ` · ${p.reference_number}` : ''}`}
                  value={formatCurrency(p.amount, c)} />
              ))}
            </div>
          )}

          {sale.returns.length > 0 && (
            <div>
              <p className="font-semibold mb-1">Returns</p>
              {sale.returns.map((r) => (
                <Row key={r.return_number}
                  label={`${r.return_number} · ${METHOD_LABELS[r.refund_method] || 'On account'}${r.reason ? ` · ${r.reason}` : ''}`}
                  value={`-${formatCurrency(r.total, c)}`} />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t print:hidden">
          {sale.document_type === 'invoice' && (
            <Link href={`/dashboard/invoices/${sale.id}`} className="btn-secondary">Open invoice</Link>
          )}
          <button onClick={() => window.print()} className="btn-primary inline-flex items-center gap-2">
            <PrinterIcon className="w-4 h-4" /> Print
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
