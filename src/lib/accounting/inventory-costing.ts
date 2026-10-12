// Pure stock-costing and journal-line helpers. No database access here, so they can be unit tested.

export interface CostLot {
  id: string;
  quantity_remaining: number;
  unit_cost: number;
}

export interface LotAllocation {
  lot_id: string;
  quantity: number;
  unit_cost: number;
}

export interface FifoResult {
  allocations: LotAllocation[];
  // Quantity not covered by any lot (stock received without a lot, e.g. opening stock or
  // goods receipts). Costed at the fallback unit cost.
  uncoveredQuantity: number;
  totalCost: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round4 = (value: number) => Math.round(value * 10000) / 10000;

// Takes `quantity` from `lots` in the order given (callers sort them: earliest expiry first,
// then oldest received). Whatever the lots cannot cover is costed at `fallbackUnitCost`.
export function allocateFifo(lots: CostLot[], quantity: number, fallbackUnitCost: number): FifoResult {
  let remaining = round4(quantity);
  const allocations: LotAllocation[] = [];
  let totalCost = 0;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const available = Number(lot.quantity_remaining);
    if (available <= 0) continue;

    const take = round4(Math.min(available, remaining));
    allocations.push({ lot_id: lot.id, quantity: take, unit_cost: Number(lot.unit_cost) });
    totalCost += take * Number(lot.unit_cost);
    remaining = round4(remaining - take);
  }

  const uncoveredQuantity = Math.max(0, remaining);
  totalCost += uncoveredQuantity * Number(fallbackUnitCost || 0);

  return { allocations, uncoveredQuantity, totalCost: round2(totalCost) };
}

export interface JournalLine {
  account_id: string;
  debit: number;
  credit: number;
  description: string;
  currency: string;
  exchange_rate: number;
}

export interface CogsGroup {
  cogs_account_id: string;
  inventory_account_id: string;
  cost: number; // in base currency
}

// Lines for a sales invoice:
//   Dr Accounts Receivable  total
//   Cr Revenue              total - tax
//   Cr VAT Payable          tax              (folded into revenue when no VAT account)
//   Dr Cost of Goods Sold   cost   } per product account pair, in base currency
//   Cr Inventory            cost   }
export function buildInvoiceJournalLines(input: {
  invoiceNumber: string;
  total: number;
  taxAmount: number;
  currency: string;
  exchangeRate: number;
  baseCurrency: string;
  accounts: { receivable: string; revenue: string; vat: string | null };
  cogs: CogsGroup[];
}): JournalLine[] {
  const { invoiceNumber, currency, exchangeRate, baseCurrency, accounts } = input;
  const total = round2(input.total);
  const tax = accounts.vat ? round2(Math.max(0, input.taxAmount || 0)) : 0;
  const net = round2(total - tax);

  const lines: JournalLine[] = [
    { account_id: accounts.receivable, debit: total, credit: 0, description: `AR - Invoice ${invoiceNumber}`, currency, exchange_rate: exchangeRate },
    { account_id: accounts.revenue, debit: 0, credit: net, description: `Revenue - Invoice ${invoiceNumber}`, currency, exchange_rate: exchangeRate },
  ];

  if (tax > 0 && accounts.vat) {
    lines.push({ account_id: accounts.vat, debit: 0, credit: tax, description: `VAT - Invoice ${invoiceNumber}`, currency, exchange_rate: exchangeRate });
  }

  for (const group of input.cogs) {
    const cost = round2(group.cost);
    if (cost <= 0) continue;
    lines.push(
      { account_id: group.cogs_account_id, debit: cost, credit: 0, description: `COGS - Invoice ${invoiceNumber}`, currency: baseCurrency, exchange_rate: 1 },
      { account_id: group.inventory_account_id, debit: 0, credit: cost, description: `Inventory out - Invoice ${invoiceNumber}`, currency: baseCurrency, exchange_rate: 1 }
    );
  }

  return lines;
}

// Base-currency totals of a set of lines; an entry is balanced when they match to the cent.
export function journalTotals(lines: JournalLine[]) {
  const debit = round2(lines.reduce((sum, l) => sum + l.debit * l.exchange_rate, 0));
  const credit = round2(lines.reduce((sum, l) => sum + l.credit * l.exchange_rate, 0));
  return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 };
}

// Ledger account a payment lands in, by payment method.
export function depositAccountCodeForMethod(method: string | null | undefined): string {
  switch (method) {
    case 'bank_transfer':
    case 'check':
    case 'card':
    case 'credit_card':
    case 'stripe':
      return '1020'; // Checking Account
    case 'mobile_money':
      return '1040'; // Mobile Money
    default:
      return '1000'; // Cash on Hand
  }
}
