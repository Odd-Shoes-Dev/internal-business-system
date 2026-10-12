'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, PrinterIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/currency';

interface ShiftSale {
  id: string;
  invoice_number: string;
  total: string;
  discount_amount: string | null;
  amount_paid: string;
  status: string;
  currency: string;
  created_at: string;
  customer_name: string | null;
}

interface SaleDetail {
  invoice_number: string;
  created_at: string;
  currency: string;
  subtotal: string;
  tax_amount: string | null;
  discount_amount: string | null;
  total: string;
  amount_paid: string;
  customer_name: string | null;
  lines: Array<{ id: string; description: string; quantity: number; line_total: number; discount_amount: number }>;
  payments: Array<{ payment_number: string; payment_method: string; amount: number; source: string | null }>;
  returns: Array<{ return_number: string; total: number }>;
}

const METHOD: Record<string, string> = { cash: 'Cash', card: 'Card', mobile_money: 'Mobile money', other: 'Other' };

// The sales rung up on this till during the current shift, newest first, with reprint
export default function ShiftSalesPanel({
  companyId,
  sessionId,
  companyName,
  receiptFooter,
  onClose,
}: {
  companyId: string;
  sessionId: string;
  companyName: string;
  receiptFooter: string;
  onClose: () => void;
}) {
  const [sales, setSales] = useState<ShiftSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SaleDetail | null>(null);

  useEffect(() => {
    fetch(`/api/pos/transactions?company_id=${companyId}&session_id=${sessionId}&limit=200`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSales(d.data || []))
      .catch(() => toast.error('Failed to load sales'))
      .finally(() => setLoading(false));
  }, [companyId, sessionId]);

  const open = async (sale: ShiftSale) => {
    try {
      const res = await fetch(`/api/sales/${sale.id}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetail(data.data);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load sale');
    }
  };

  const total = sales.reduce((s, x) => s + Number(x.total), 0);
  const currency = sales[0]?.currency || 'UGX';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:bg-white print:p-0">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col print:shadow-none print:max-h-none receipt-print">
        <div className="flex items-center justify-between p-5 border-b print:hidden">
          <div className="flex items-center gap-2">
            {detail && <button onClick={() => setDetail(null)} className="p-1 rounded hover:bg-gray-100"><ArrowLeftIcon className="w-5 h-5" /></button>}
            <h2 className="text-lg font-bold">{detail ? detail.invoice_number : 'Sales this shift'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
        </div>

        {!detail ? (
          <>
            <div className="overflow-y-auto divide-y flex-1">
              {loading && <p className="p-6 text-center text-sm text-gray-500">Loading…</p>}
              {!loading && sales.length === 0 && <p className="p-6 text-center text-sm text-gray-500">No sales on this shift yet</p>}
              {sales.map((sale) => {
                const owed = Number(sale.total) - Number(sale.amount_paid);
                return (
                  <button key={sale.id} onClick={() => open(sale)} className="w-full text-left px-5 py-3 hover:bg-gray-50 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono">{sale.invoice_number}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {sale.customer_name ? ` · ${sale.customer_name}` : ''}
                        {owed > 0.01 ? ` · owes ${formatCurrency(owed, sale.currency as any)}` : ''}
                      </p>
                    </div>
                    <span className="font-semibold">{formatCurrency(Number(sale.total), sale.currency as any)}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t flex justify-between text-sm">
              <span>{sales.length} sale{sales.length === 1 ? '' : 's'}</span>
              <span className="font-bold">{formatCurrency(total, currency as any)}</span>
            </div>
          </>
        ) : (
          <div className="p-5 space-y-3 text-sm overflow-y-auto">
            <div className="text-center border-b pb-3">
              <p className="font-bold text-base">{companyName}</p>
              <p className="text-xs text-gray-500">{new Date(detail.created_at).toLocaleString()}</p>
              {detail.customer_name && <p className="text-xs text-gray-500">Customer: {detail.customer_name}</p>}
              <p className="text-xs font-mono text-gray-400">{detail.invoice_number} (copy)</p>
            </div>
            {detail.lines.map((l) => (
              <div key={l.id} className="flex justify-between">
                <span>{l.description} x{l.quantity}</span>
                <span>{formatCurrency(l.line_total, detail.currency as any)}</span>
              </div>
            ))}
            <div className="border-t pt-2 space-y-1">
              {Number(detail.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-gray-500"><span>Discounts</span><span>-{formatCurrency(Number(detail.discount_amount), detail.currency as any)}</span></div>
              )}
              {Number(detail.tax_amount || 0) > 0 && (
                <div className="flex justify-between text-gray-500"><span>Tax</span><span>{formatCurrency(Number(detail.tax_amount), detail.currency as any)}</span></div>
              )}
              <div className="flex justify-between font-bold"><span>TOTAL</span><span>{formatCurrency(Number(detail.total), detail.currency as any)}</span></div>
              {detail.payments.filter((p) => p.source !== 'pos_return').map((p) => (
                <div key={p.payment_number} className="flex justify-between text-gray-500">
                  <span>{METHOD[p.payment_method] || p.payment_method}</span><span>{formatCurrency(p.amount, detail.currency as any)}</span>
                </div>
              ))}
              {detail.returns.map((r) => (
                <div key={r.return_number} className="flex justify-between text-red-600">
                  <span>Returned ({r.return_number})</span><span>-{formatCurrency(r.total, detail.currency as any)}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-gray-400 border-t pt-2 whitespace-pre-line">{receiptFooter}</p>
            <button onClick={() => window.print()} className="btn-primary w-full inline-flex items-center justify-center gap-2 print:hidden">
              <PrinterIcon className="w-4 h-4" /> Print copy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
