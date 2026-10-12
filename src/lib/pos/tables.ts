// Table orders in restaurant mode. A table's cart is the till's cart with one extra field per
// line: sent_quantity, how much of it the kitchen already has a ticket for.

import type { PosLineInput } from '@/lib/pos/pricing';

export interface TableLine extends PosLineInput {
  sent_quantity?: number;
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;

// What still has to go to the kitchen (new items, or more of an item already sent)
export function unsentLines(cart: TableLine[]): Array<{ product_id: string; name: string; quantity: number }> {
  return cart
    .map((l) => ({ product_id: l.product_id, name: l.name, quantity: round4(Number(l.quantity) - Number(l.sent_quantity || 0)) }))
    .filter((l) => l.quantity > 0);
}

export function markAllSent<T extends TableLine>(cart: T[]): T[] {
  return cart.map((l) => ({ ...l, sent_quantity: Number(l.quantity) }));
}

// Splits a bill: `pay` maps product_id -> quantity paid now. Returns the lines to charge and
// the lines left on the table. A line's manual discount is shared in proportion to quantity.
export function splitTableCart<T extends TableLine>(cart: T[], pay: Record<string, number>) {
  const charge: T[] = [];
  const remaining: T[] = [];
  for (const line of cart) {
    const quantity = Number(line.quantity);
    const paying = Math.min(Math.max(Number(pay[line.product_id] || 0), 0), quantity);
    const left = round4(quantity - paying);
    const discount = Number(line.discount_amount || 0);
    const sent = Number(line.sent_quantity || 0);
    if (paying > 0) {
      charge.push({
        ...line,
        quantity: paying,
        discount_amount: Math.round(((discount * paying) / quantity) * 100) / 100,
        sent_quantity: Math.min(sent, paying),
      });
    }
    if (left > 0) {
      remaining.push({
        ...line,
        quantity: left,
        discount_amount: Math.round((discount - (discount * paying) / quantity) * 100) / 100,
        sent_quantity: Math.max(0, sent - paying),
      });
    }
  }
  return { charge, remaining };
}

// Adds one table's lines into another's (moving guests to a joined table)
export function mergeTableCarts(into: TableLine[], from: TableLine[]): TableLine[] {
  const result = into.map((l) => ({ ...l }));
  for (const line of from) {
    const same = result.find((l) => l.product_id === line.product_id && Number(l.unit_price) === Number(line.unit_price));
    if (same) {
      same.quantity = round4(Number(same.quantity) + Number(line.quantity));
      same.discount_amount = Number(same.discount_amount || 0) + Number(line.discount_amount || 0);
      same.sent_quantity = Number(same.sent_quantity || 0) + Number(line.sent_quantity || 0);
    } else {
      result.push({ ...line });
    }
  }
  return result;
}
