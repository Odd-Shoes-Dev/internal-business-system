'use client';

import { useState } from 'react';
import { MinusIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/currency';
import { pricePosCart } from '@/lib/pos/pricing';
import { splitTableCart, type TableLine } from '@/lib/pos/tables';

// Choose what one guest pays for; the rest stays on the table.
export default function SplitBillModal({
  cart,
  currency,
  onConfirm,
  onClose,
}: {
  cart: TableLine[];
  currency: string;
  onConfirm: (pay: Record<string, number>) => void;
  onClose: () => void;
}) {
  const [pay, setPay] = useState<Record<string, number>>({});
  const set = (id: string, qty: number, max: number) => setPay((p) => ({ ...p, [id]: Math.min(Math.max(0, qty), max) }));
  const { charge } = splitTableCart(cart, pay);
  const total = pricePosCart(charge).total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">Split the bill</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-2 max-h-[55vh] overflow-y-auto">
          <p className="text-sm text-gray-500">Choose what is being paid for now.</p>
          {cart.map((line) => {
            const qty = pay[line.product_id] || 0;
            const max = Number(line.quantity);
            return (
              <div key={line.product_id} className="flex items-center gap-3 border rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{line.name}</p>
                  <p className="text-xs text-gray-500">{max} on the table · {formatCurrency(Number(line.unit_price), currency as any)} each</p>
                </div>
                <button onClick={() => set(line.product_id, qty - 1, max)} className="w-7 h-7 rounded-lg border flex items-center justify-center"><MinusIcon className="w-3 h-3" /></button>
                <span className="w-6 text-center font-bold">{qty}</span>
                <button onClick={() => set(line.product_id, qty + 1, max)} className="w-7 h-7 rounded-lg border flex items-center justify-center"><PlusIcon className="w-3 h-3" /></button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 p-5 border-t">
          <span className="font-bold">{formatCurrency(total, currency as any)}</span>
          <div className="flex gap-2">
            <button onClick={() => setPay(Object.fromEntries(cart.map((l) => [l.product_id, Number(l.quantity)])))} className="btn-secondary">All</button>
            <button disabled={!charge.length} onClick={() => onConfirm(pay)} className="btn-primary">Charge these</button>
          </div>
        </div>
      </div>
    </div>
  );
}
