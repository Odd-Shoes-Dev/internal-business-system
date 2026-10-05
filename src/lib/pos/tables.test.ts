import { describe, expect, it } from 'vitest';
import { markAllSent, mergeTableCarts, splitTableCart, unsentLines, type TableLine } from './tables';

const line = (over: Partial<TableLine>): TableLine => ({
  product_id: 'tea', name: 'Tea', quantity: 2, unit_price: 3000, tax_rate: 0, discount_amount: 0, ...over,
});

describe('kitchen tickets', () => {
  it('sends only what the kitchen has not seen', () => {
    const cart = [line({ quantity: 3, sent_quantity: 1 }), line({ product_id: 'cake', name: 'Cake', quantity: 1, sent_quantity: 1 })];
    expect(unsentLines(cart)).toEqual([{ product_id: 'tea', name: 'Tea', quantity: 2 }]);
    expect(unsentLines(markAllSent(cart))).toEqual([]);
  });
});

describe('splitTableCart', () => {
  it('charges part and leaves the rest, sharing the discount by quantity', () => {
    const cart = [line({ quantity: 4, discount_amount: 400, sent_quantity: 4 }), line({ product_id: 'cake', name: 'Cake', quantity: 1 })];
    const { charge, remaining } = splitTableCart(cart, { tea: 1, cake: 1 });
    expect(charge).toEqual([
      expect.objectContaining({ product_id: 'tea', quantity: 1, discount_amount: 100, sent_quantity: 1 }),
      expect.objectContaining({ product_id: 'cake', quantity: 1 }),
    ]);
    expect(remaining).toEqual([expect.objectContaining({ product_id: 'tea', quantity: 3, discount_amount: 300, sent_quantity: 3 })]);
  });

  it('caps at what is on the table', () => {
    const { charge, remaining } = splitTableCart([line({ quantity: 2 })], { tea: 9 });
    expect(charge[0].quantity).toBe(2);
    expect(remaining).toEqual([]);
  });
});

describe('mergeTableCarts', () => {
  it('adds matching lines together and keeps the others', () => {
    const merged = mergeTableCarts(
      [line({ quantity: 1, sent_quantity: 1 })],
      [line({ quantity: 2, sent_quantity: 0 }), line({ product_id: 'cake', name: 'Cake', quantity: 1 })]
    );
    expect(merged).toEqual([
      expect.objectContaining({ product_id: 'tea', quantity: 3, sent_quantity: 1 }),
      expect.objectContaining({ product_id: 'cake', quantity: 1 }),
    ]);
  });
});
