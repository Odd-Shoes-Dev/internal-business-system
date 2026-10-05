// Till settings stored per company in companies.settings -> 'pos'. Safe to import in the browser.

export interface LoyaltySettings {
  enabled: boolean;
  amount_per_point: number; // money a customer spends to earn 1 point, e.g. 1000 (UGX)
  point_value: number; // money 1 point is worth when redeemed, e.g. 10 (UGX)
  min_redeem_points: number; // smallest redemption allowed
}

export interface PosSettings {
  receipt_header: string;
  receipt_footer: string;
  loyalty: LoyaltySettings;
}

export const DEFAULT_POS_SETTINGS: PosSettings = {
  receipt_header: '',
  receipt_footer: 'Thank you for your purchase!',
  loyalty: { enabled: false, amount_per_point: 1000, point_value: 10, min_redeem_points: 0 },
};

const num = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function parsePosSettings(raw: unknown): PosSettings {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const loyalty = (value.loyalty && typeof value.loyalty === 'object' ? value.loyalty : {}) as Record<string, any>;
  const d = DEFAULT_POS_SETTINGS;
  return {
    receipt_header: typeof value.receipt_header === 'string' ? value.receipt_header.slice(0, 500) : d.receipt_header,
    receipt_footer: typeof value.receipt_footer === 'string' ? value.receipt_footer.slice(0, 500) : d.receipt_footer,
    loyalty: {
      enabled: loyalty.enabled === true,
      amount_per_point: num(loyalty.amount_per_point, d.loyalty.amount_per_point),
      point_value: num(loyalty.point_value, d.loyalty.point_value),
      min_redeem_points: num(loyalty.min_redeem_points, d.loyalty.min_redeem_points),
    },
  };
}

// Points earned for money paid on a sale
export function loyaltyPointsEarned(amountPaid: number, loyalty: LoyaltySettings): number {
  if (!loyalty.enabled || loyalty.amount_per_point <= 0 || amountPaid <= 0) return 0;
  return Math.floor(amountPaid / loyalty.amount_per_point);
}

// Money value of redeeming `points`
export function loyaltyRedemptionValue(points: number, loyalty: LoyaltySettings): number {
  if (!loyalty.enabled || points <= 0) return 0;
  return Math.round(points * loyalty.point_value * 100) / 100;
}

// Most points a customer can use on a cart: their balance, capped so the discount never exceeds the cart
export function maxRedeemablePoints(balance: number, cartAmount: number, loyalty: LoyaltySettings): number {
  if (!loyalty.enabled || loyalty.point_value <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(balance), Math.floor(cartAmount / loyalty.point_value)));
}
