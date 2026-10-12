'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownTrayIcon, ClockIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/currency';
import { downloadCsv } from '@/lib/csv';

interface ExpiringLot {
  lot_id: string;
  lot_number: string | null;
  expiry_date: string;
  days_left: number;
  quantity: number;
  value: number;
  product_id: string;
  product_name: string;
  sku: string | null;
  shelf_location: string | null;
  unit_of_measure: string;
}

// Batches that have expired or expire soon. Expired stock should be written off with a
// stock adjustment (reason: Expired) so the ledger shows the loss.
export default function ExpiringSection({ companyId, currency }: { companyId: string; currency: string }) {
  const [days, setDays] = useState(30);
  const [lots, setLots] = useState<ExpiringLot[]>([]);

  useEffect(() => {
    fetch(`/api/inventory/expiring?company_id=${companyId}&days=${days}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLots(d.data || []))
      .catch(() => setLots([]));
  }, [companyId, days]);

  const expired = lots.filter((l) => l.days_left < 0);
  const totalValue = lots.reduce((s, l) => s + l.value, 0);

  return (
    <div className="card">
      <div className="card-body space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><ClockIcon className="w-5 h-5 text-amber-500" /> Expiring stock</h2>
            <p className="text-sm text-gray-500">
              {expired.length} expired batch{expired.length === 1 ? '' : 'es'} · {lots.length - expired.length} expiring within {days} days ·
              {' '}{formatCurrency(totalValue, currency as any)} at cost
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>Next {d} days</option>)}
            </select>
            <button className="btn-secondary inline-flex items-center gap-1" disabled={!lots.length}
              onClick={() => downloadCsv(`expiring-stock-${new Date().toISOString().slice(0, 10)}.csv`,
                ['Product', 'SKU', 'Batch', 'Expiry', 'Days left', 'Quantity', 'Unit', 'Shelf', 'Value at cost'],
                lots.map((l) => [l.product_name, l.sku, l.lot_number, l.expiry_date, l.days_left, l.quantity, l.unit_of_measure, l.shelf_location, l.value.toFixed(2)]))}>
              <ArrowDownTrayIcon className="w-4 h-4" /> CSV
            </button>
          </div>
        </div>

        {lots.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing expires in the next {days} days.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 border-b">
              <tr><th className="py-2">Product</th><th className="py-2">Batch</th><th className="py-2">Expiry</th><th className="py-2 text-right">Quantity</th><th className="py-2 text-right">Value</th></tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.lot_id} className="border-b last:border-0">
                  <td className="py-2">
                    <Link href={`/dashboard/inventory/${l.product_id}`} className="text-blueox-primary hover:underline">{l.product_name}</Link>
                    {l.shelf_location && <span className="text-xs text-gray-400"> · {l.shelf_location}</span>}
                  </td>
                  <td className="py-2 font-mono text-xs">{l.lot_number || '—'}</td>
                  <td className="py-2">
                    {l.expiry_date}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${l.days_left < 0 ? 'bg-red-100 text-red-700' : l.days_left <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                      {l.days_left < 0 ? `expired ${-l.days_left}d ago` : l.days_left === 0 ? 'today' : `${l.days_left}d left`}
                    </span>
                  </td>
                  <td className="py-2 text-right">{l.quantity} {l.unit_of_measure}</td>
                  <td className="py-2 text-right">{formatCurrency(l.value, currency as any)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {expired.length > 0 && (
          <p className="text-xs text-gray-500">
            Remove expired batches from the shelf and record them as a <Link href="/dashboard/inventory/adjust" className="text-blueox-primary hover:underline">stock adjustment</Link> with reason “Expired”.
          </p>
        )}
      </div>
    </div>
  );
}
