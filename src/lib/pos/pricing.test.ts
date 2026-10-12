import { describe, expect, it } from 'vitest';
import { pricePosCart } from './pricing';
import { loyaltyPointsEarned, loyaltyRedemptionValue, maxRedeemablePoints, parsePosSettings } from './settings';

const item = (over: Partial<Parameters<typeof pricePosCart>[0][number]> = {}) => ({
  product_id: 'p', name: 'Item', quantity: 1, unit_price: 1000, tax_rate: 0, ...over,
});

describe('pricePosCart', () => {
  it('prices a plain cart with tax', () => {
    const cart = pricePosCart([item({ quantity: 2, unit_price: 1000, tax_rate: 0.18 })]);
    expect(cart).toMatchObject({ gross: 2000, discount: 0, subtotal: 2000, tax: 360, total: 2360 });
  });

  it('applies line discounts before tax and caps them at the line value', () => {
    const cart = pricePosCart([
      item({ unit_price: 1000, tax_rate: 0.18, discount_amount: 100 }),
      item({ unit_price: 500, discount_amount: 9999 }),
    ]);
    expect(cart.lines[0]).toMatchObject({ net: 900, tax: 162 });
    expect(cart.lines[1]).toMatchObject({ line_discount: 500, net: 0 });
    expect(cart.total).toBe(1062);
  });

  it('spreads a cart discount by value and the shares add up exactly', () => {
    const cart = pricePosCart([item({ unit_price: 1000 }), item({ unit_price: 2000 }), item({ unit_price: 333 })], 100);
    const shares = cart.lines.map((l) => l.allocated_discount);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    expect(shares[1]).toBeGreaterThan(shares[0]);
    expect(cart.subtotal).toBe(3233);
  });

  it('taxes each line on its discounted value', () => {
    const cart = pricePosCart([item({ unit_price: 1000, tax_rate: 0.18 }), item({ unit_price: 1000, tax_rate: 0 })], 200);
    expect(cart.lines[0]).toMatchObject({ allocated_discount: 100, net: 900, tax: 162 });
    expect(cart.tax).toBe(162);
  });

  it('never discounts below zero', () => {
    const cart = pricePosCart([item({ unit_price: 100 })], 500);
    expect(cart.total).toBe(0);
    expect(cart.discount).toBe(100);
  });
});

describe('loyalty', () => {
  const loyalty = { enabled: true, amount_per_point: 1000, point_value: 10, min_redeem_points: 0 };

  it('earns whole points only', () => {
    expect(loyaltyPointsEarned(2999, loyalty)).toBe(2);
    expect(loyaltyPointsEarned(2999, { ...loyalty, enabled: false })).toBe(0);
  });

  it('values and caps redemptions', () => {
    expect(loyaltyRedemptionValue(50, loyalty)).toBe(500);
    expect(maxRedeemablePoints(500, 1234, loyalty)).toBe(123);
    expect(maxRedeemablePoints(20.7, 99999, loyalty)).toBe(20);
  });

  it('parses stored settings with defaults and rejects bad values', () => {
    const s = parsePosSettings({ receipt_footer: 'Bye', loyalty: { enabled: true, amount_per_point: -5 } });
    expect(s.receipt_footer).toBe('Bye');
    expect(s.loyalty.enabled).toBe(true);
    expect(s.loyalty.amount_per_point).toBe(1000);
    expect(parsePosSettings(null).loyalty.enabled).toBe(false);
  });
});
