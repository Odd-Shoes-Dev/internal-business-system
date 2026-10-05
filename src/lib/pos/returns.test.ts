import { describe, expect, it } from 'vitest';
import { priceReturn, type SoldLine } from './returns';

const line: SoldLine = {
  id: 'l1', product_id: 'p1', description: 'Soda', quantity: 3, unit_price: 1000,
  line_total: 2900, tax_amount: 522, returned_quantity: 0,
};

describe('priceReturn', () => {
  it('refunds what was paid per unit, including tax', () => {
    const result = priceReturn([line], [{ invoice_line_id: 'l1', quantity: 1, restock: true }]);
    expect(result).toMatchObject({ subtotal: 966.67, tax: 174, total: 1140.67 });
  });

  it('never refunds more than the line across several returns', () => {
    const first = priceReturn([line], [{ invoice_line_id: 'l1', quantity: 1, restock: true }]) as any;
    const second = priceReturn([{ ...line, returned_quantity: 1 }], [{ invoice_line_id: 'l1', quantity: 1, restock: true }]) as any;
    const third = priceReturn([{ ...line, returned_quantity: 2 }], [{ invoice_line_id: 'l1', quantity: 1, restock: true }]) as any;
    expect(first.subtotal + second.subtotal + third.subtotal).toBeCloseTo(2900, 2);
    expect(first.tax + second.tax + third.tax).toBeCloseTo(522, 2);
  });

  it('refuses returning more than is left', () => {
    const result = priceReturn([{ ...line, returned_quantity: 2 }], [{ invoice_line_id: 'l1', quantity: 2, restock: true }]);
    expect(result).toEqual({ error: 'Only 1 of "Soda" can still be returned' });
  });

  it('refuses items not on the sale and empty returns', () => {
    expect(priceReturn([line], [{ invoice_line_id: 'x', quantity: 1, restock: true }])).toHaveProperty('error');
    expect(priceReturn([line], [{ invoice_line_id: 'l1', quantity: 0, restock: true }])).toHaveProperty('error');
  });
});
