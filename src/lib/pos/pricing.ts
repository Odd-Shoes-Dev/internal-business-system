// Till pricing, shared by the till screen and the POS API so both compute the same totals.
// Matches how invoices store amounts: line_total and subtotal are net of discount, before tax;
// total = subtotal + tax.

export interface PosLineInput {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number; // decimal, e.g. 0.18
  discount_amount?: number; // discount on this line, in money
}

export interface PricedLine extends PosLineInput {
  gross: number; // quantity x unit price
  line_discount: number; // the line's own discount
  allocated_discount: number; // its share of the cart discount
  net: number; // gross - discounts, before tax
  tax: number;
}

export interface PricedCart {
  lines: PricedLine[];
  gross: number;
  discount: number; // line + cart discounts
  subtotal: number; // net, before tax
  tax: number;
  total: number;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// cartDiscount is spread over the lines in proportion to their value after line discounts,
// so each line's tax is charged on what the customer actually pays for it.
export function pricePosCart(items: PosLineInput[], cartDiscount = 0): PricedCart {
  const base = items.map((item) => {
    const gross = round2(Number(item.quantity) * Number(item.unit_price));
    const lineDiscount = round2(Math.min(Math.max(Number(item.discount_amount || 0), 0), gross));
    return { item, gross, lineDiscount, afterLine: round2(gross - lineDiscount) };
  });

  const discountable = round2(base.reduce((sum, b) => sum + b.afterLine, 0));
  const cartDiscountApplied = round2(Math.min(Math.max(Number(cartDiscount || 0), 0), discountable));

  let allocatedSoFar = 0;
  let lastDiscountableIndex = -1;
  base.forEach((b, i) => { if (b.afterLine > 0) lastDiscountableIndex = i; });

  const lines: PricedLine[] = base.map((b, i) => {
    let allocated = 0;
    if (cartDiscountApplied > 0 && b.afterLine > 0) {
      allocated = i === lastDiscountableIndex
        ? round2(cartDiscountApplied - allocatedSoFar) // remainder, so shares add up exactly
        : round2((cartDiscountApplied * b.afterLine) / discountable);
      allocated = Math.min(allocated, b.afterLine);
      allocatedSoFar = round2(allocatedSoFar + allocated);
    }
    const net = round2(b.afterLine - allocated);
    const tax = round2(net * Number(b.item.tax_rate || 0));
    return { ...b.item, gross: b.gross, line_discount: b.lineDiscount, allocated_discount: allocated, net, tax };
  });

  const gross = round2(lines.reduce((sum, l) => sum + l.gross, 0));
  const subtotal = round2(lines.reduce((sum, l) => sum + l.net, 0));
  const tax = round2(lines.reduce((sum, l) => sum + l.tax, 0));
  return { lines, gross, discount: round2(gross - subtotal), subtotal, tax, total: round2(subtotal + tax) };
}
