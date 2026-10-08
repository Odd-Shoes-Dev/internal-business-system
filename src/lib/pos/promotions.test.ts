import { describe, expect, it } from 'vitest';
import { applyPromotions, bestPromotionForLine, promotionAmount, type Promotion } from './promotions';

const now = new Date('2026-10-05T12:00:00Z');
const promo = (over: Partial<Promotion>): Promotion => ({
  id: 'p', name: 'Promo', type: 'percentage', discount_value: 10, buy_quantity: null, get_quantity: null,
  starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-31T00:00:00Z', is_active: true, product_ids: ['soda'], ...over,
});

describe('promotionAmount', () => {
  it('percentage off the line', () => expect(promotionAmount(promo({ discount_value: 15 }), 2, 1000)).toBe(300));
  it('fixed off each unit, never below zero', () => {
    expect(promotionAmount(promo({ type: 'fixed', discount_value: 200 }), 3, 1000)).toBe(600);
    expect(promotionAmount(promo({ type: 'fixed', discount_value: 5000 }), 1, 1000)).toBe(1000);
  });
  it('buy 2 get 1 free per group of 3', () => {
    const b2g1 = promo({ type: 'buy_x_get_y', buy_quantity: 2, get_quantity: 1 });
    expect(promotionAmount(b2g1, 2, 1000)).toBe(0);
    expect(promotionAmount(b2g1, 3, 1000)).toBe(1000);
    expect(promotionAmount(b2g1, 7, 1000)).toBe(2000);
  });
});

describe('bestPromotionForLine', () => {
  const line = { product_id: 'soda', quantity: 3, unit_price: 1000 };

  it('picks the biggest saving and ignores other products', () => {
    const hit = bestPromotionForLine(line, [
      promo({ id: 'a', discount_value: 10 }),
      promo({ id: 'b', type: 'buy_x_get_y', buy_quantity: 2, get_quantity: 1 }),
      promo({ id: 'c', discount_value: 90, product_ids: ['bread'] }),
    ], now);
    expect(hit).toMatchObject({ promotion_id: 'b', amount: 1000 });
  });

  it('ignores inactive, future and expired promotions', () => {
    expect(bestPromotionForLine(line, [
      promo({ is_active: false }),
      promo({ starts_at: '2026-11-01T00:00:00Z', ends_at: '2026-12-01T00:00:00Z' }),
      promo({ starts_at: '2026-09-01T00:00:00Z', ends_at: '2026-10-05T12:00:00Z' }),
    ], now)).toBeNull();
  });
});

describe('applyPromotions', () => {
  it('adds the promotion to any manual discount', () => {
    const [line] = applyPromotions([{ product_id: 'soda', quantity: 2, unit_price: 1000, discount_amount: 50 }], [promo({})], now);
    expect(line.discount_amount).toBe(250);
    expect(line.promotion?.amount).toBe(200);
  });
});
