// Promotions applied at the till. Shared by the till screen (to show prices) and the POS
// API (which recomputes them, so a client cannot invent a discount).

export interface Promotion {
  id: string;
  name: string;
  type: 'percentage' | 'fixed' | 'buy_x_get_y';
  discount_value: number; // percentage: % off; fixed: money off each unit
  buy_quantity: number | null;
  get_quantity: number | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  product_ids: string[];
}

export interface PromotionHit {
  promotion_id: string;
  name: string;
  amount: number;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function isPromotionLive(promo: Promotion, now: Date = new Date()): boolean {
  return promo.is_active && new Date(promo.starts_at) <= now && now < new Date(promo.ends_at);
}

// Money off one cart line from one promotion
export function promotionAmount(promo: Promotion, quantity: number, unitPrice: number): number {
  const gross = quantity * unitPrice;
  let amount = 0;
  if (promo.type === 'percentage') {
    amount = (gross * Math.min(Number(promo.discount_value), 100)) / 100;
  } else if (promo.type === 'fixed') {
    amount = Math.min(Number(promo.discount_value), unitPrice) * quantity;
  } else if (promo.type === 'buy_x_get_y' && promo.buy_quantity && promo.get_quantity) {
    // Buy 2 get 1: every group of 3 has 1 free unit
    const group = promo.buy_quantity + promo.get_quantity;
    const freeUnits = Math.floor(quantity / group) * promo.get_quantity;
    amount = freeUnits * unitPrice;
  }
  return round2(Math.min(Math.max(amount, 0), gross));
}

// The best live promotion for a line (customers get the biggest saving, offers don't stack)
export function bestPromotionForLine(
  line: { product_id: string; quantity: number; unit_price: number },
  promotions: Promotion[],
  now: Date = new Date()
): PromotionHit | null {
  let best: PromotionHit | null = null;
  for (const promo of promotions) {
    if (!isPromotionLive(promo, now) || !promo.product_ids.includes(line.product_id)) continue;
    const amount = promotionAmount(promo, Number(line.quantity), Number(line.unit_price));
    if (amount > 0 && (!best || amount > best.amount)) best = { promotion_id: promo.id, name: promo.name, amount };
  }
  return best;
}

// Adds each line's promotion to its own discount (a manual discount and a promotion both apply)
export function applyPromotions<T extends { product_id: string; quantity: number; unit_price: number; discount_amount?: number }>(
  items: T[],
  promotions: Promotion[],
  now: Date = new Date()
): Array<T & { promotion: PromotionHit | null }> {
  return items.map((item) => {
    const promotion = bestPromotionForLine(item, promotions, now);
    return {
      ...item,
      discount_amount: round2(Number(item.discount_amount || 0) + (promotion?.amount || 0)),
      promotion,
    };
  });
}
