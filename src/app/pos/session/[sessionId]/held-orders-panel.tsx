'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/currency';
import { pricePosCart, type PosLineInput } from '@/lib/pos/pricing';

export interface HeldOrder {
  id: string;
  label: string | null;
  cart: PosLineInput[];
  cart_discount: string | number;
  customer_id: string | null;
  customer_name: string | null;
  customer_loyalty_points: string | null;
  customer_whatsapp_number: string | null;
  customer_phone: string | null;
  created_by_name: string | null;
  created_at: string;
}

export default function HeldOrdersPanel({
  companyId,
  currency,
  onResume,
  onClose,
}: {
  companyId: string;
  currency: string;
  onResume: (order: HeldOrder) => void;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<HeldOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pos/held-orders?company_id=${companyId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setOrders(d.data || []))
      .catch(() => toast.error('Failed to load held orders'))
      .finally(() => setLoading(false));
  }, [companyId]);

  const remove = async (order: HeldOrder, resume: boolean) => {
    setBusyId(order.id);
    try {
      const res = await fetch(`/api/pos/held-orders/${order.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).error);
      if (resume) onResume(order);
      else setOrders((list) => list.filter((o) => o.id !== order.id));
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">Held orders</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y">
          {loading && <p className="p-6 text-sm text-gray-500 text-center">Loading...</p>}
          {!loading && orders.length === 0 && <p className="p-6 text-sm text-gray-500 text-center">No held orders</p>}
          {orders.map((order) => {
            const priced = pricePosCart(order.cart, Number(order.cart_discount || 0));
            const itemCount = order.cart.reduce((sum, i) => sum + Number(i.quantity), 0);
            return (
              <div key={order.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{order.label || order.customer_name || 'Held order'}</p>
                  <p className="text-xs text-gray-500">
                    {itemCount} items · {formatCurrency(priced.total, currency)} · {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {order.created_by_name ? ` · ${order.created_by_name}` : ''}
                  </p>
                </div>
                <button disabled={busyId === order.id} onClick={() => remove(order, false)} className="btn-secondary btn-sm">Discard</button>
                <button disabled={busyId === order.id} onClick={() => remove(order, true)} className="btn-primary btn-sm">Resume</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
