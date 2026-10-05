import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { applyPendingMigrations, checkDeferredConstraints, client, testDb } from './db-harness';

// Real route handlers, with auth replaced by a fixed user and the database by the
// rolled-back test transaction.
const state = vi.hoisted(() => ({ user: { id: '', email: 'test@example.com', role: 'admin' } }));

vi.mock('@/lib/provider/route-guards', async () => {
  const { testDb } = await import('./db-harness');
  return {
    requireSessionUser: async () => ({ db: testDb, user: state.user, errorResponse: null }),
    requireCompanyAccess: async () => null,
    requireCompanyAdmin: async () => null,
    getCompanyIdFromRequest: (request: any, body?: any) =>
      body?.company_id || new URL(request.url).searchParams.get('company_id'),
  };
});
vi.mock('@/lib/provider', async () => {
  const { testDb } = await import('./db-harness');
  return { getDbProvider: () => testDb };
});
const afterCalls: Array<() => unknown> = [];
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: (fn: () => unknown) => { afterCalls.push(fn); } };
});

const { POST: postSale } = await import('@/app/api/pos/transactions/route');
const { GET: lookupReturn, POST: postReturn } = await import('@/app/api/pos/returns/route');
const { GET: listHeld, POST: holdOrder } = await import('@/app/api/pos/held-orders/route');
const { DELETE: deleteHeld } = await import('@/app/api/pos/held-orders/[id]/route');
const { PATCH: closeSession } = await import('@/app/api/pos/sessions/[id]/route');
const { PUT: putWhatsapp, GET: getWhatsapp } = await import('@/app/api/companies/whatsapp/route');
const { savePosSettingsWithDb } = await import('@/lib/pos/settings-db');
const { GET: listSales } = await import('@/app/api/sales/route');
const { GET: getSale } = await import('@/app/api/sales/[id]/route');

const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, body: body ? JSON.stringify(body) : undefined });

let companyId = '';
let currency = 'UGX';
let sessionId = '';
let productId = '';
let customerId = '';
let connected = false;

async function ledgerLines(journalEntryId: string) {
  const r = await client.query(
    `SELECT a.code, jl.debit::float AS debit, jl.credit::float AS credit
     FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
     WHERE jl.journal_entry_id = $1 ORDER BY jl.line_number`,
    [journalEntryId]
  );
  return r.rows;
}

beforeAll(async () => {
  if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is required');
  process.env.APP_ENCRYPTION_KEY ||= Buffer.alloc(32, 9).toString('base64');
  await client.connect();
  connected = true;
  await client.query('BEGIN');
  await applyPendingMigrations(113);

  const company = (await client.query('SELECT id, currency FROM companies ORDER BY created_at LIMIT 1')).rows[0];
  if (!company) throw new Error('The test database needs at least one company');
  companyId = company.id;
  currency = company.currency || 'UGX';
  state.user.id = (await client.query('SELECT user_id FROM user_companies WHERE company_id = $1 LIMIT 1', [companyId])).rows[0].user_id;

  // VAT, 1040 etc. come from the seed; make sure this company has them
  await client.query('SELECT seed_default_chart_of_accounts($1)', [companyId]);

  await savePosSettingsWithDb(testDb, companyId, {
    receipt_header: '', receipt_footer: 'Thanks',
    loyalty: { enabled: true, amount_per_point: 100, point_value: 1, min_redeem_points: 0 },
  });

  productId = (await client.query(
    `INSERT INTO products (name, sku, unit_price, cost_price, track_inventory, quantity_on_hand, company_id, is_taxable, tax_rate)
     VALUES ('Int test soda', 'INT-' || floor(random()*1e9), 1000, 400, true, 10, $1, true, 0.18) RETURNING id`,
    [companyId]
  )).rows[0].id;
  await client.query(
    `INSERT INTO inventory_lots (product_id, lot_number, quantity_received, quantity_remaining, unit_cost, received_date)
     VALUES ($1, 'INT-LOT', 10, 10, 400, CURRENT_DATE)`,
    [productId]
  );

  customerId = (await client.query(
    `INSERT INTO customers (company_id, name, whatsapp_number, loyalty_points, credit_limit, payment_terms)
     VALUES ($1, 'Int Test Customer', '0772000000', 50, 0, 14) RETURNING id`,
    [companyId]
  )).rows[0].id;

  const terminal = (await client.query(
    `INSERT INTO pos_terminals (company_id, name) VALUES ($1, 'Int test till') RETURNING id`, [companyId]
  )).rows[0];
  sessionId = (await client.query(
    `INSERT INTO pos_sessions (company_id, terminal_id, opened_by, opening_float, currency, status)
     VALUES ($1, $2, $3, 5000, $4, 'open') RETURNING id`,
    [companyId, terminal.id, state.user.id, currency]
  )).rows[0].id;
});

afterAll(async () => {
  if (!connected) return;
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
});

describe('POS sale with discounts, loyalty and credit', () => {
  let invoice: any;

  it('records the sale, ledger, loyalty and customer balance', async () => {
    // 3 x 1000 = 3000, line discount 200 -> 2800, cart discount 100, redeem 50 pts (= 50) -> net 2650,
    // VAT 18% = 477 -> total 3127. Pay 1000 cash now, 2127 on account.
    const res = await postSale(json('/api/pos/transactions', 'POST', {
      company_id: companyId, session_id: sessionId, currency, customer_id: customerId,
      items: [{ product_id: productId, name: 'Int test soda', quantity: 3, unit_price: 1000, tax_rate: 0.18, discount_amount: 200 }],
      cart_discount: 100, loyalty_points_redeemed: 50, pay_later: true,
      payments: [{ method: 'cash', amount: 1000 }],
    }));
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(201);
    invoice = body.data;

    expect(Number(invoice.subtotal)).toBe(2650);
    expect(Number(invoice.tax_amount)).toBe(477);
    expect(Number(invoice.discount_amount)).toBe(350);
    expect(Number(invoice.total)).toBe(3127);
    expect(Number(invoice.amount_paid)).toBe(1000);
    expect(invoice.status).toBe('partial');
    expect(body.balance_due).toBe(2127);

    // Loyalty: 50 - 50 redeemed + floor(1000 / 100) = 10
    expect(body.loyalty).toMatchObject({ points_redeemed: 50, points_earned: 10, balance: 10 });

    const sale = await ledgerLines(invoice.journal_entry_id);
    expect(sale).toEqual([
      { code: '1100', debit: 3127, credit: 0 },
      { code: '4000', debit: 0, credit: 2650 },
      { code: '2200', debit: 0, credit: 477 },
      { code: '5000', debit: 1200, credit: 0 }, // 3 x 400 FIFO cost
      { code: '1200', debit: 0, credit: 1200 },
    ]);
    await checkDeferredConstraints();

    const customer = (await client.query('SELECT current_balance::float AS b, loyalty_points::float AS p FROM customers WHERE id = $1', [customerId])).rows[0];
    expect(customer).toEqual({ b: 2127, p: 10 });
    expect(afterCalls).toHaveLength(1); // WhatsApp confirmation queued
  });

  it('rejects a credit sale without a customer', async () => {
    const res = await postSale(json('/api/pos/transactions', 'POST', {
      company_id: companyId, session_id: sessionId, currency, pay_later: true, payments: [],
      items: [{ product_id: productId, name: 'Int test soda', quantity: 1, unit_price: 1000, tax_rate: 0 }],
    }));
    expect(res.status).toBe(400);
  });

  it('refunds part on account and part in cash, restocking at original cost', async () => {
    const lookup = await lookupReturn(json(`/api/pos/returns?company_id=${companyId}&number=${invoice.invoice_number}`, 'GET'));
    const sale = (await lookup.json()).data;
    expect(sale.refundable_money).toBe(1000);
    expect(sale.balance_due).toBe(2127);
    const lineId = sale.lines[0].id;

    // 1 of 3 back to the account: net 2650/3 = 883.33, tax 159 -> 1042.33
    const onAccount = await postReturn(json('/api/pos/returns', 'POST', {
      company_id: companyId, invoice_id: invoice.id, session_id: sessionId, refund_method: 'account',
      lines: [{ invoice_line_id: lineId, quantity: 1, restock: true }],
    }));
    const accountBody = await onAccount.json();
    expect(onAccount.status, JSON.stringify(accountBody)).toBe(201);
    expect(Number(accountBody.data.total)).toBeCloseTo(1042.33, 2);
    expect(await ledgerLines(accountBody.data.journal_entry_id)).toEqual([
      { code: '4000', debit: 883.33, credit: 0 },
      { code: '2200', debit: 159, credit: 0 },
      { code: '1100', debit: 0, credit: 1042.33 },
      { code: '1200', debit: 400, credit: 0 },
      { code: '5000', debit: 0, credit: 400 },
    ]);

    // Another 1 refunded in cash, damaged (not restocked)
    const cash = await postReturn(json('/api/pos/returns', 'POST', {
      company_id: companyId, invoice_id: invoice.id, session_id: sessionId, refund_method: 'cash',
      lines: [{ invoice_line_id: lineId, quantity: 1, restock: false }],
    }));
    const cashBody = await cash.json();
    expect(cash.status, JSON.stringify(cashBody)).toBe(201);
    const cashLines = await ledgerLines(cashBody.data.journal_entry_id);
    expect(cashLines.map((l: any) => l.code)).toEqual(['4000', '2200', '1000']);
    await checkDeferredConstraints();

    // Too much: only 1 left
    const tooMany = await postReturn(json('/api/pos/returns', 'POST', {
      company_id: companyId, invoice_id: invoice.id, refund_method: 'cash',
      lines: [{ invoice_line_id: lineId, quantity: 2, restock: true }],
    }));
    expect(tooMany.status).toBe(400);

    const product = (await client.query('SELECT quantity_on_hand::float AS q FROM products WHERE id = $1', [productId])).rows[0];
    expect(product.q).toBe(8); // 10 - 3 sold + 1 restocked

    const inv = (await client.query('SELECT amount_paid::float AS paid, status FROM invoices WHERE id = $1', [invoice.id])).rows[0];
    expect(inv.paid).toBeCloseTo(2042.33, 2);
    expect(inv.status).toBe('partial');

    const customer = (await client.query('SELECT current_balance::float AS b, loyalty_points::float AS p FROM customers WHERE id = $1', [customerId])).rows[0];
    expect(customer.b).toBeCloseTo(1084.67, 2);
    expect(customer.p).toBeLessThan(10); // points earned on the returned share taken back
  });

  it('lists the sale on the Sales page with totals, detail and CSV', async () => {
    const res = await listSales(json(`/api/sales?company_id=${companyId}&source=pos&search=${invoice.invoice_number}`, 'GET'));
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ invoice_number: invoice.invoice_number, document_type: 'pos_sale', payment_methods: 'cash' });
    expect(body.data[0].refunded).toBeCloseTo(2084.67, 2);
    expect(body.summary).toMatchObject({ count: 1, total: 3127, discounts: 350, tax: 477 });

    const unpaid = await (await listSales(json(`/api/sales?company_id=${companyId}&status=paid&search=${invoice.invoice_number}`, 'GET'))).json();
    expect(unpaid.data).toHaveLength(0); // still owes a balance

    const detail = await (await getSale(json(`/api/sales/${invoice.id}`, 'GET'), { params: Promise.resolve({ id: invoice.id }) })).json();
    expect(detail.data.lines).toHaveLength(1);
    expect(detail.data.returns).toHaveLength(2);
    expect(detail.data.payments.map((p: any) => p.source)).toEqual(['pos', 'pos_return']);

    const csv = await (await listSales(json(`/api/sales?company_id=${companyId}&format=csv&search=${invoice.invoice_number}`, 'GET'))).text();
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv).toContain(invoice.invoice_number);
  });

  it('closes the shift with cash refunds taken out of expected cash', async () => {
    const res = await closeSession(json(`/api/pos/sessions/${sessionId}`, 'PATCH', { closing_cash_count: 5000 }), {
      params: Promise.resolve({ id: sessionId }),
    });
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    // float 5000 + cash 1000 - cash refund 1042.34 (second unit: cumulative pricing gives it the extra cent)
    expect(Number(body.data.expected_cash)).toBeCloseTo(4957.66, 2);
  });
});

describe('held orders', () => {
  it('holds, lists and removes a cart', async () => {
    const res = await holdOrder(json('/api/pos/held-orders', 'POST', {
      company_id: companyId, label: 'Table 4', customer_id: customerId,
      cart: [{ product_id: productId, name: 'Int test soda', quantity: 2, unit_price: 1000, tax_rate: 0.18, discount_amount: 0 }],
    }));
    const held = (await res.json()).data;
    expect(res.status).toBe(201);

    const list = (await (await listHeld(json(`/api/pos/held-orders?company_id=${companyId}`, 'GET'))).json()).data;
    expect(list.find((o: any) => o.id === held.id)).toMatchObject({ label: 'Table 4', customer_name: 'Int Test Customer' });

    const del = await deleteHeld(json(`/api/pos/held-orders/${held.id}`, 'DELETE'), { params: Promise.resolve({ id: held.id }) });
    expect(del.status).toBe(200);
  });
});

describe('WhatsApp settings', () => {
  it('stores the token encrypted and never returns it', async () => {
    const put = await putWhatsapp(json('/api/companies/whatsapp', 'PUT', {
      company_id: companyId, enabled: true, phone_number_id: '123456789', access_token: 'EAAG-secret-token',
    }));
    expect(put.status).toBe(200);

    const row = (await client.query('SELECT access_token_encrypted FROM company_whatsapp_settings WHERE company_id = $1', [companyId])).rows[0];
    expect(row.access_token_encrypted).toMatch(/^v1:/);
    expect(row.access_token_encrypted).not.toContain('EAAG');

    const get = await (await getWhatsapp(json(`/api/companies/whatsapp?company_id=${companyId}`, 'GET'))).json();
    expect(get.data).toMatchObject({ enabled: true, phone_number_id: '123456789', has_access_token: true });
    expect(JSON.stringify(get)).not.toContain('EAAG');
  });
});
