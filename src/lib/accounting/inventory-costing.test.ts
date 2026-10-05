import { describe, expect, it } from 'vitest';
import {
  allocateFifo,
  buildInvoiceJournalLines,
  depositAccountCodeForMethod,
  journalTotals,
} from './inventory-costing';

describe('allocateFifo', () => {
  const lots = [
    { id: 'a', quantity_remaining: 3, unit_cost: 150 },
    { id: 'b', quantity_remaining: 2, unit_cost: 100 },
  ];

  it('takes from lots in the given order', () => {
    const result = allocateFifo(lots, 4, 999);
    expect(result.allocations).toEqual([
      { lot_id: 'a', quantity: 3, unit_cost: 150 },
      { lot_id: 'b', quantity: 1, unit_cost: 100 },
    ]);
    expect(result.uncoveredQuantity).toBe(0);
    expect(result.totalCost).toBe(550);
  });

  it('costs quantity beyond the lots at the fallback cost', () => {
    const result = allocateFifo(lots, 7, 80);
    expect(result.uncoveredQuantity).toBe(2);
    expect(result.totalCost).toBe(3 * 150 + 2 * 100 + 2 * 80);
  });

  it('skips empty lots and handles no lots', () => {
    expect(allocateFifo([{ id: 'x', quantity_remaining: 0, unit_cost: 10 }], 2, 5).totalCost).toBe(10);
    expect(allocateFifo([], 2.5, 4).totalCost).toBe(10);
  });

  it('handles fractional quantities without float drift', () => {
    const result = allocateFifo([{ id: 'a', quantity_remaining: 0.3, unit_cost: 10 }], 0.1 + 0.2, 0);
    expect(result.uncoveredQuantity).toBe(0);
    expect(result.allocations[0].quantity).toBe(0.3);
  });
});

describe('buildInvoiceJournalLines', () => {
  const accounts = { receivable: 'AR', revenue: 'REV', vat: 'VAT' };

  it('splits tax to VAT and posts COGS in base currency', () => {
    const lines = buildInvoiceJournalLines({
      invoiceNumber: 'POS-1',
      total: 1180,
      taxAmount: 180,
      currency: 'UGX',
      exchangeRate: 1,
      baseCurrency: 'UGX',
      accounts,
      cogs: [{ cogs_account_id: 'COGS', inventory_account_id: 'INV', cost: 550 }],
    });

    const byAccount = Object.fromEntries(lines.map((l) => [l.account_id, l]));
    expect(byAccount.AR.debit).toBe(1180);
    expect(byAccount.REV.credit).toBe(1000);
    expect(byAccount.VAT.credit).toBe(180);
    expect(byAccount.COGS.debit).toBe(550);
    expect(byAccount.INV.credit).toBe(550);
    expect(journalTotals(lines).balanced).toBe(true);
  });

  it('folds tax into revenue when the company has no VAT account', () => {
    const lines = buildInvoiceJournalLines({
      invoiceNumber: 'INV-1', total: 118, taxAmount: 18, currency: 'USD', exchangeRate: 1,
      baseCurrency: 'USD', accounts: { ...accounts, vat: null }, cogs: [],
    });
    expect(lines).toHaveLength(2);
    expect(lines[1].credit).toBe(118);
  });

  it('stays balanced for a foreign-currency invoice with base-currency COGS', () => {
    const lines = buildInvoiceJournalLines({
      invoiceNumber: 'INV-2', total: 100, taxAmount: 18, currency: 'USD', exchangeRate: 3700,
      baseCurrency: 'UGX', accounts,
      cogs: [{ cogs_account_id: 'COGS', inventory_account_id: 'INV', cost: 150000 }],
    });
    const cogsLine = lines.find((l) => l.account_id === 'COGS')!;
    expect(cogsLine.currency).toBe('UGX');
    expect(cogsLine.exchange_rate).toBe(1);
    expect(journalTotals(lines).balanced).toBe(true);
  });

  it('skips zero-cost COGS groups', () => {
    const lines = buildInvoiceJournalLines({
      invoiceNumber: 'INV-3', total: 50, taxAmount: 0, currency: 'USD', exchangeRate: 1,
      baseCurrency: 'USD', accounts, cogs: [{ cogs_account_id: 'C', inventory_account_id: 'I', cost: 0 }],
    });
    expect(lines).toHaveLength(2);
  });
});

describe('depositAccountCodeForMethod', () => {
  it('maps payment methods to ledger accounts', () => {
    expect(depositAccountCodeForMethod('cash')).toBe('1000');
    expect(depositAccountCodeForMethod('card')).toBe('1020');
    expect(depositAccountCodeForMethod('bank_transfer')).toBe('1020');
    expect(depositAccountCodeForMethod('mobile_money')).toBe('1040');
    expect(depositAccountCodeForMethod(undefined)).toBe('1000');
  });
});
