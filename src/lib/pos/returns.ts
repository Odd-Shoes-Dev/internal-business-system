// Pricing a return from the original sale's lines. A returned unit is refunded at what the
// customer actually paid for it: the line's net (after discounts) and tax, per unit.

export interface SoldLine {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number; // net of discount, before tax
  tax_amount: number;
  returned_quantity: number; // already returned on earlier returns
}

export interface ReturnRequestLine {
  invoice_line_id: string;
  quantity: number;
  restock: boolean;
}

export interface PricedReturnLine {
  invoice_line_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  net: number;
  tax: number;
  restock: boolean;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function priceReturn(
  sold: SoldLine[],
  requested: ReturnRequestLine[]
): { lines: PricedReturnLine[]; subtotal: number; tax: number; total: number } | { error: string } {
  const byId = new Map(sold.map((line) => [line.id, line]));
  const lines: PricedReturnLine[] = [];

  for (const request of requested) {
    const quantity = Number(request.quantity);
    if (!(quantity > 0)) continue;

    const line = byId.get(request.invoice_line_id);
    if (!line) return { error: 'A returned item is not on this sale' };

    const returnable = Number(line.quantity) - Number(line.returned_quantity || 0);
    if (quantity > returnable + 1e-9) {
      return { error: `Only ${returnable} of "${line.description}" can still be returned` };
    }

    // Price cumulatively: (refunded through this return) - (refunded before it). Each return's
    // rounding cancels the previous one's, so all returns of a line add up to exactly what was paid.
    const already = Number(line.returned_quantity || 0);
    const soldQuantity = Number(line.quantity);
    const upTo = (amount: number, units: number) => round2((Number(amount) * units) / soldQuantity);
    const net = round2(upTo(line.line_total, already + quantity) - upTo(line.line_total, already));
    const tax = round2(upTo(line.tax_amount, already + quantity) - upTo(line.tax_amount, already));

    lines.push({
      invoice_line_id: line.id,
      product_id: line.product_id,
      description: line.description,
      quantity,
      unit_price: Number(line.unit_price),
      net,
      tax,
      restock: request.restock !== false,
    });
  }

  if (!lines.length) return { error: 'Choose at least one item to return' };

  const subtotal = round2(lines.reduce((sum, l) => sum + l.net, 0));
  const tax = round2(lines.reduce((sum, l) => sum + l.tax, 0));
  return { lines, subtotal, tax, total: round2(subtotal + tax) };
}
