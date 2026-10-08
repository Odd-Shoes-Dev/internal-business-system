import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { applyPendingMigrations, client } from './db-harness';
import { splitTableCart, type TableLine } from '@/lib/pos/tables';

const state = vi.hoisted(() => ({ user: { id: '', email: 'test@example.com', role: 'admin' } }));
vi.mock('@/lib/provider/route-guards', async () => {
  const { testDb } = await import('./db-harness');
  return {
    requireSessionUser: async () => ({ db: testDb, user: state.user, errorResponse: null }),
    requireCompanyAccess: async () => null,
    requireCompanyAdmin: async () => null,
    getCompanyIdFromRequest: (request: any, body?: any) => body?.company_id || new URL(request.url).searchParams.get('company_id'),
  };
});
vi.mock('@/lib/provider', async () => {
  const { testDb } = await import('./db-harness');
  return { getDbProvider: () => testDb };
});
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: () => {} }));

const { GET: listTables, POST: createTable } = await import('@/app/api/pos/tables/route');
const { PUT: saveOrder } = await import('@/app/api/pos/tables/[id]/order/route');
const { POST: moveOrder } = await import('@/app/api/pos/tables/[id]/move/route');
const { DELETE: removeTable } = await import('@/app/api/pos/tables/[id]/route');
const { GET: listHeld } = await import('@/app/api/pos/held-orders/route');
const { POST: postSale } = await import('@/app/api/pos/transactions/route');

const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, body: body ? JSON.stringify(body) : undefined });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

let companyId = '';
let currency = 'UGX';
let productId = '';
let sessionId = '';
let connected = false;

beforeAll(async () => {
  await client.connect();
  connected = true;
  await client.query('BEGIN');
  await applyPendingMigrations(113);
  const company = (await client.query('SELECT id, currency FROM companies ORDER BY created_at LIMIT 1')).rows[0];
  companyId = company.id;
  currency = company.currency || 'UGX';
  state.user.id = (await client.query(`SELECT user_id FROM user_companies WHERE company_id = $1 AND role IN ('owner','admin') LIMIT 1`, [companyId])).rows[0].user_id;
  await client.query('SELECT seed_default_chart_of_accounts($1)', [companyId]);
  productId = (await client.query(
    `INSERT INTO products (company_id, name, sku, unit_price, cost_price, track_inventory, quantity_on_hand, is_taxable)
     VALUES ($1, 'Int tea', 'INT-TEA-' || floor(random()*1e9), 3000, 500, false, 0, false) RETURNING id`, [companyId]
  )).rows[0].id;
  const terminal = (await client.query(`INSERT INTO pos_terminals (company_id, name) VALUES ($1, 'Int till') RETURNING id`, [companyId])).rows[0];
  sessionId = (await client.query(
    `INSERT INTO pos_sessions (company_id, terminal_id, opened_by, opening_float, currency, status)
     VALUES ($1, $2, $3, 0, $4, 'open') RETURNING id`, [companyId, terminal.id, state.user.id, currency]
  )).rows[0].id;
});

afterAll(async () => {
  if (!connected) return;
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
});

describe('restaurant tables', () => {
  let t1 = '';
  let t2 = '';
  const tea = (quantity: number, sent = 0): TableLine =>
    ({ product_id: productId, name: 'Int tea', quantity, unit_price: 3000, tax_rate: 0, discount_amount: 0, sent_quantity: sent });

  it('creates tables and refuses duplicate names', async () => {
    t1 = (await (await createTable(req('/api/pos/tables', 'POST', { company_id: companyId, name: 'Int T1', area: 'Patio', seats: 4 }))).json()).data.id;
    t2 = (await (await createTable(req('/api/pos/tables', 'POST', { company_id: companyId, name: 'Int T2' }))).json()).data.id;
    const dup = await createTable(req('/api/pos/tables', 'POST', { company_id: companyId, name: 'int t1' }));
    expect(dup.status).toBe(409);
  });

  it('keeps one open order per table, out of the held-orders list', async () => {
    const first = await saveOrder(req(`/api/pos/tables/${t1}/order`, 'PUT', { cart: [tea(2, 2)], guests: 2, session_id: sessionId }), ctx(t1));
    expect(first.status, JSON.stringify(await first.clone().json())).toBe(200);
    await saveOrder(req(`/api/pos/tables/${t1}/order`, 'PUT', { cart: [tea(3, 2)], guests: 3, session_id: sessionId }), ctx(t1));
    const tables = (await (await listTables(req(`/api/pos/tables?company_id=${companyId}`, 'GET'))).json()).data;
    const row = tables.find((t: any) => t.id === t1);
    expect(row).toMatchObject({ area: 'Patio', guests: 3 });
    expect(row.cart[0].quantity).toBe(3);
    const held = (await (await listHeld(req(`/api/pos/held-orders?company_id=${companyId}`, 'GET'))).json()).data;
    expect(held.some((h: any) => h.id === row.order_id)).toBe(false);
  });

  it('moves a table onto another and merges the orders', async () => {
    await saveOrder(req(`/api/pos/tables/${t2}/order`, 'PUT', { cart: [tea(1)], guests: 1 }), ctx(t2));
    const res = await moveOrder(req(`/api/pos/tables/${t1}/move`, 'POST', { to_table_id: t2 }), ctx(t1));
    expect((await res.json()).data).toEqual({ merged: true });
    const tables = (await (await listTables(req(`/api/pos/tables?company_id=${companyId}`, 'GET'))).json()).data;
    expect(tables.find((t: any) => t.id === t1).order_id).toBeNull();
    const merged = tables.find((t: any) => t.id === t2);
    expect(merged.cart[0]).toMatchObject({ quantity: 4, sent_quantity: 2 });
    expect(merged.guests).toBe(4);
  });

  it('splits the bill: charges part and leaves the rest on the table', async () => {
    const order = (await (await listTables(req(`/api/pos/tables?company_id=${companyId}`, 'GET'))).json()).data.find((t: any) => t.id === t2);
    const { charge, remaining } = splitTableCart(order.cart, { [productId]: 1 });
    const sale = await postSale(req('/api/pos/transactions', 'POST', {
      company_id: companyId, session_id: sessionId, currency, items: charge, payments: [{ method: 'cash', amount: 3000 }],
    }));
    expect(sale.status, JSON.stringify(await sale.clone().json())).toBe(201);
    await saveOrder(req(`/api/pos/tables/${t2}/order`, 'PUT', { cart: remaining }), ctx(t2));
    const after = (await (await listTables(req(`/api/pos/tables?company_id=${companyId}`, 'GET'))).json()).data.find((t: any) => t.id === t2);
    expect(after.cart[0].quantity).toBe(3);

    const busy = await removeTable(req(`/api/pos/tables/${t2}`, 'DELETE'), ctx(t2));
    expect(busy.status).toBe(400); // open order still there
    await saveOrder(req(`/api/pos/tables/${t2}/order`, 'PUT', { cart: [] }), ctx(t2));
    expect((await removeTable(req(`/api/pos/tables/${t2}`, 'DELETE'), ctx(t2))).status).toBe(200);
  });
});
