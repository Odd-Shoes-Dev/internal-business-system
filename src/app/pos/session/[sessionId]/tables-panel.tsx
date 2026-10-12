'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/currency';
import { pricePosCart } from '@/lib/pos/pricing';
import type { TableLine } from '@/lib/pos/tables';

export interface FloorTable {
  id: string;
  name: string;
  area: string | null;
  seats: number | null;
  order_id: string | null;
  cart: TableLine[] | null;
  cart_discount: string | number | null;
  guests: number | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_loyalty_points: string | null;
  customer_whatsapp_number: string | null;
  customer_phone: string | null;
  opened_at: string | null;
}

const minutesSince = (iso: string | null) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : 0);

// The floor: every table, free or with its running order. `mode="move"` picks a destination.
export default function TablesPanel({
  companyId,
  currency,
  mode = 'open',
  excludeTableId,
  onPick,
  onClose,
}: {
  companyId: string;
  currency: string;
  mode?: 'open' | 'move';
  excludeTableId?: string | null;
  onPick: (table: FloorTable) => void;
  onClose: () => void;
}) {
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/pos/tables?company_id=${companyId}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTables(data.data);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000); // other tills update tables too
    return () => clearInterval(timer);
  }, [load]);

  const areas = [...new Set(tables.map((t) => t.area || ''))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">{mode === 'move' ? 'Move order to…' : 'Tables'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-6">
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {!loading && tables.length === 0 && (
            <p className="text-sm text-gray-500">No tables yet. Add them in Settings → Point of Sale.</p>
          )}
          {areas.map((area) => (
            <div key={area || 'none'}>
              {area && <p className="text-xs font-semibold uppercase text-gray-500 mb-2">{area}</p>}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {tables.filter((t) => (t.area || '') === area && t.id !== excludeTableId).map((t) => {
                  const busy = Boolean(t.order_id);
                  const total = busy && t.cart ? pricePosCart(t.cart, Number(t.cart_discount || 0)).total : 0;
                  return (
                    <button key={t.id} onClick={() => onPick(t)}
                      className={`rounded-xl border-2 p-3 text-left transition-colors ${busy ? 'border-amber-400 bg-amber-50 hover:bg-amber-100' : 'border-gray-200 hover:border-blueox-primary'}`}>
                      <p className="font-bold">{t.name}</p>
                      {busy ? (
                        <>
                          <p className="text-sm font-semibold">{formatCurrency(total, currency as any)}</p>
                          <p className="text-xs text-gray-600">
                            {t.guests ? `${t.guests} guests · ` : ''}{minutesSince(t.opened_at)} min
                            {mode === 'move' ? ' · will merge' : ''}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-500">Free{t.seats ? ` · ${t.seats} seats` : ''}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
