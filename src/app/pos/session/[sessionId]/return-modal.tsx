'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/currency';
import { priceReturn, type SoldLine } from '@/lib/pos/returns';

interface SaleForReturn {
  id: string;
  invoice_number: string;
  invoice_date: string;
  currency: string;
  total: string;
  customer_id: string | null;
  customer_name: string | null;
  lines: SoldLine[];
  refundable_money: number;
  balance_due: number;
}

type RefundMethod = 'cash' | 'card' | 'mobile_money' | 'account';

export default function ReturnModal({
  companyId,
  sessionId,
  onDone,
  onClose,
}: {
  companyId: string;
  sessionId: string;
  onDone: (refund: { total: number; method: RefundMethod; returnNumber: string }) => void;
  onClose: () => void;
}) {
  const [number, setNumber] = useState('');
  const [sale, setSale] = useState<SaleForReturn | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const [method, setMethod] = useState<RefundMethod>('cash');
  const [reason, setReason] = useState('');
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);

  const lookup = async () => {
    if (!number.trim()) return;
    setLooking(true);
    try {
      const res = await fetch(`/api/pos/returns?company_id=${companyId}&number=${encodeURIComponent(number.trim())}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSale(data.data);
      setQuantities({});
      setRestock(Object.fromEntries(data.data.lines.map((l: SoldLine) => [l.id, true])));
      setMethod(data.data.refundable_money > 0 ? 'cash' : 'account');
    } catch (e: any) {
      toast.error(e.message || 'Sale not found');
      setSale(null);
    } finally {
      setLooking(false);
    }
  };

  const requested = sale
    ? sale.lines.map((l) => ({ invoice_line_id: l.id, quantity: Number(quantities[l.id] || 0), restock: restock[l.id] !== false }))
    : [];
  const preview = sale && requested.some((r) => r.quantity > 0) ? priceReturn(sale.lines, requested) : null;

  const submit = async () => {
    if (!sale || !preview || 'error' in preview) return;
    setSaving(true);
    try {
      const res = await fetch('/api/pos/returns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          invoice_id: sale.id,
          session_id: sessionId,
          refund_method: method,
          reason: reason || null,
          lines: requested.filter((r) => r.quantity > 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Return ${data.data.return_number} recorded`);
      onDone({ total: Number(data.data.total), method, returnNumber: data.data.return_number });
    } catch (e: any) {
      toast.error(e.message || 'Return failed');
    } finally {
      setSaving(false);
    }
  };

  const currency = sale?.currency || 'UGX';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">Return / refund</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input pl-9 font-mono"
                autoFocus
                placeholder="Receipt number, e.g. POS-2026-000123"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookup()}
              />
            </div>
            <button onClick={lookup} disabled={looking} className="btn-secondary">{looking ? 'Finding...' : 'Find sale'}</button>
          </div>

          {sale && (
            <>
              <p className="text-sm text-gray-600">
                {sale.invoice_number} · {sale.invoice_date} · {formatCurrency(Number(sale.total), currency)}
                {sale.customer_name ? ` · ${sale.customer_name}` : ''}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-right">Sold</th>
                    <th className="py-2 text-right">Can return</th>
                    <th className="py-2 text-right w-24">Return</th>
                    <th className="py-2 text-center">Back to stock</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.map((line) => {
                    const left = line.quantity - line.returned_quantity;
                    return (
                      <tr key={line.id} className="border-b last:border-0">
                        <td className="py-2">{line.description}</td>
                        <td className="py-2 text-right">{line.quantity}</td>
                        <td className="py-2 text-right">{left}</td>
                        <td className="py-2 text-right">
                          <input
                            type="number" min="0" max={left} step="any" disabled={left <= 0}
                            className="input py-1 text-right"
                            value={quantities[line.id] ?? ''}
                            onChange={(e) => setQuantities((q) => ({ ...q, [line.id]: e.target.value }))}
                          />
                        </td>
                        <td className="py-2 text-center">
                          <input type="checkbox" disabled={!line.product_id} checked={restock[line.id] !== false}
                            title="Untick for damaged goods that cannot be sold again"
                            onChange={(e) => setRestock((r) => ({ ...r, [line.id]: e.target.checked }))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Refund as</label>
                  <select className="input" value={method} onChange={(e) => setMethod(e.target.value as RefundMethod)}>
                    <option value="cash" disabled={sale.refundable_money <= 0}>Cash</option>
                    <option value="mobile_money" disabled={sale.refundable_money <= 0}>Mobile money</option>
                    <option value="card" disabled={sale.refundable_money <= 0}>Card</option>
                    <option value="account" disabled={!sale.customer_id || sale.balance_due <= 0}>Reduce what the customer owes</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Up to {formatCurrency(sale.refundable_money, currency)} can be paid back
                    {sale.balance_due > 0 ? `; ${formatCurrency(sale.balance_due, currency)} is still owed` : ''}.
                  </p>
                </div>
                <div>
                  <label className="label">Reason</label>
                  <input className="input" placeholder="e.g. damaged, wrong size" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
              </div>

              {preview && 'error' in preview && <p className="text-sm text-red-600">{preview.error}</p>}
              {preview && !('error' in preview) && (
                <div className="rounded-xl bg-gray-50 border p-3 text-sm flex justify-between">
                  <span>Refund (incl. {formatCurrency(preview.tax, currency)} tax)</span>
                  <span className="font-bold">{formatCurrency(preview.total, currency)}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving || !preview || 'error' in preview} className="btn-danger">
            {saving ? 'Recording...' : 'Record return'}
          </button>
        </div>
      </div>
    </div>
  );
}
