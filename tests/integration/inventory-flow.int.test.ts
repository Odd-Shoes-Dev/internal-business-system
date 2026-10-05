import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { applyPendingMigrations, checkDeferredConstraints, client, testDb } from './db-harness';

// Real route handlers for purchasing, receiving, adjustments, promotions and products, run in a
// transaction that is rolled back. Auth is a fixed admin user.
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
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: () => {} };
});

const { POST: createPO } = await import('@/app/api/purchase-orders/route');
const { POST: approvePO } = await import('@/app/api/purchase-orders/[id]/approve/route');
const { POST: createReceipt } = await import('@/app/api/goods-receipts/route');
const { PATCH: setReceiptStatus } = await import('@/app/api/goods-receipts/[id]/status/route');
const { POST: createBill } = await import('@/app/api/bills/route');
const { GET: listAdjustments, POST: createAdjustment } = await import('@/app/api/stock-adjustments/route');
const { POST: approveAdjustment } = await import('@/app/api/stock-adjustments/[id]/approve/route');
const { POST: rejectAdjustment } = await import('@/app/api/stock-adjustments/[id]/reject/route');
const { POST: createProduct } = await import('@/app/api/inventory/route');
const { PATCH: editProduct } = await import('@/app/api/products/[id]/route');
const { POST: createPromotion } = await import('@/app/api/promotions/route');
const { POST: postSale } = await import('@/app/api/pos/transactions/route');

const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, body: body ? JSON.stringify(body) : undefined });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

let companyId = '';
let currency = 'UGX';
let vendorId = '';
let productId = '';
let connected = false;

const q = async (sql: string, params: any[] = []) => (await client.query(sql, params)).rows;
const product = async (id: string) =>
  (await q('SELECT quantity_on_hand::float AS qty, cost_price::float AS cost FROM products WHERE id = $1', [id]))[0];
const lines = async (journalEntryId: string) =>
  q(`SELECT a.code, jl.debit::float AS debit, jl.credit::float AS credit FROM journal_lines jl
     JOIN accounts a ON a.id = jl.account_id WHERE jl.journal_entry_id = $1 ORDER BY jl.line_number`, [journalEntryId]);

beforeAll(async () => {
  process.env.APP_ENCRYPTION_KEY ||= Buffer.alloc(32, 9).toString('base64');
  await client.connect();
  connected = true;
  await client.query('BEGIN');
  await applyPendingMigrations(113);

  const company = (await q('SELECT id, currency FROM companies ORDER BY created_at LIMIT 1'))[0];
  companyId = company.id;
  currency = company.currency || 'UGX';
  state.user.id = (await q(`SELECT user_id FROM user_companies WHERE company_id = $1 AND role IN ('owner', 'admin') LIMIT 1`, [companyId]))[0].user_id;
  await q('SELECT seed_default_chart_of_accounts($1)', [companyId]);

  vendorId = (await q(`INSERT INTO vendors (company_id, name) VALUES ($1, 'Int Test Supplier') RETURNING id`, [companyId]))[0].id;
  productId = (await q(
    `INSERT INTO products (company_id, name, sku, unit_price, cost_price, track_inventory, quantity_on_hand,
                           unit_of_measure, purchase_unit, units_per_purchase_unit, is_taxable)
     VALUES ($1, 'Int test juice', 'INT-' || floor(random()*1e9), 1500, 0, true, 0, 'bottle', 'carton', 24, false)
     RETURNING id`, [companyId]
  ))[0].id;
});

afterAll(async () => {
  if (!connected) return;
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
});

describe('purchasing and receiving', () => {
  let poId = '';
  let poLineId = '';

  it('creates and approves a purchase order', async () => {
    const res = await createPO(req('/api/purchase-orders', 'POST', {
      company_id: companyId, vendor_id: vendorId, po_date: '2026-10-05', currency,
      lines: [{ product_id: productId, description: 'Juice', quantity: 48, unit_price: 500 }],
    }));
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(201);
    poId = body.data?.id ?? body.id;
    const po = (await q('SELECT company_id, po_number, order_date, po_date FROM purchase_orders WHERE id = $1', [poId]))[0];
    expect(po.company_id).toBe(companyId);
    expect(String(po.order_date)).toBe(String(po.po_date)); // old column kept in step
    poLineId = (await q('SELECT id, quantity::float AS quantity, quantity_ordered::float AS qo FROM purchase_order_lines WHERE purchase_order_id = $1', [poId]))[0].id;

    const approved = await approvePO(req(`/api/purchase-orders/${poId}/approve`, 'POST', {}), ctx(poId));
    expect(approved.status, JSON.stringify(await approved.clone().json())).toBe(200);
  });

  it('receives part in cartons with a lot and expiry, then the rest', async () => {
    // 1 carton x 24 at 12,000 a carton = 500 a bottle
    const res = await createReceipt(req('/api/goods-receipts', 'POST', {
      purchase_order_id: poId, receipt_date: '2026-10-05',
      lines: [{ purchase_order_line_id: poLineId, purchase_quantity: 1, purchase_unit: 'carton', units_per_purchase_unit: 24,
                purchase_unit_cost: 12000, lot_number: 'LOT-A', expiry_date: '2026-12-31' }],
    }));
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(201);
    const grId = body.data?.id ?? body.id;
    expect((await product(productId)).qty).toBe(0); // not in stock until accepted

    const accept = await setReceiptStatus(req(`/api/goods-receipts/${grId}/status`, 'PATCH', { status: 'accepted' }), ctx(grId));
    expect(accept.status, JSON.stringify(await accept.clone().json())).toBe(200);
    expect(await product(productId)).toEqual({ qty: 24, cost: 500 });

    const lot = (await q(`SELECT lot_number, quantity_remaining::float AS qty, unit_cost::float AS cost, expiry_date::text AS expiry
                          FROM inventory_lots WHERE product_id = $1`, [productId]))[0];
    expect(lot).toEqual({ lot_number: 'LOT-A', qty: 24, cost: 500, expiry: '2026-12-31' });

    const gr = (await q('SELECT status, journal_entry_id FROM goods_receipts WHERE id = $1', [grId]))[0];
    expect(gr.status).toBe('accepted');
    expect(await lines(gr.journal_entry_id)).toEqual([
      { code: '1200', debit: 12000, credit: 0 },
      { code: '2150', debit: 0, credit: 12000 },
    ]);
    expect((await q('SELECT status FROM purchase_orders WHERE id = $1', [poId]))[0].status).toBe('partially_received');

    const again = await setReceiptStatus(req(`/api/goods-receipts/${grId}/status`, 'PATCH', { status: 'accepted' }), ctx(grId));
    expect(again.status).toBe(400); // cannot bring the same goods in twice

    const rest = await createReceipt(req('/api/goods-receipts', 'POST', {
      purchase_order_id: poId, receipt_date: '2026-10-05', accept_now: true,
      lines: [{ purchase_order_line_id: poLineId, quantity_received: 24, unit_cost: 550, lot_number: 'LOT-B', expiry_date: '2026-11-15' }],
    }));
    expect(rest.status, JSON.stringify(await rest.clone().json())).toBe(201);
    expect((await product(productId)).qty).toBe(48);
    expect((await q('SELECT status FROM purchase_orders WHERE id = $1', [poId]))[0].status).toBe('received');
    await checkDeferredConstraints();
  });

  it('receives stock without a purchase order', async () => {
    const res = await createReceipt(req('/api/goods-receipts', 'POST', {
      company_id: companyId, vendor_id: vendorId, receipt_date: '2026-10-05', accept_now: true,
      lines: [{ product_id: productId, quantity_received: 2, unit_cost: 600 }],
    }));
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
    expect((await product(productId)).qty).toBe(50);
  });

  it('bills stock items against 2150 without adding stock', async () => {
    const res = await createBill(req(`/api/bills?company_id=${companyId}`, 'POST', {
      company_id: companyId, vendor_id: vendorId, bill_date: '2026-10-05', due_date: '2026-11-05', status: 'approved', currency,
      lines: [{ product_id: productId, description: 'Juice', quantity: 48, unit_cost: 525 }],
    }));
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(201);
    expect((await product(productId)).qty).toBe(50);
    const bill = (await q('SELECT journal_entry_id FROM bills WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT 1', [vendorId]))[0];
    const billLines = await lines(bill.journal_entry_id);
    expect(billLines.map((l: any) => l.code).sort()).toEqual(['2000', '2150']);
  });
});

describe('selling uses the lot that expires first', () => {
  it('sells from LOT-B (expires Nov) before LOT-A (Dec) and applies a live promotion', async () => {
    const promo = await createPromotion(req('/api/promotions', 'POST', {
      company_id: companyId, name: 'Buy 2 get 1', type: 'buy_x_get_y', buy_quantity: 2, get_quantity: 1,
      starts_at: '2026-01-01T00:00:00Z', ends_at: '2099-01-01T00:00:00Z', product_ids: [productId],
    }));
    expect(promo.status, JSON.stringify(await promo.clone().json())).toBe(201);

    const terminal = (await q(`INSERT INTO pos_terminals (company_id, name) VALUES ($1, 'Int till') RETURNING id`, [companyId]))[0];
    const session = (await q(
      `INSERT INTO pos_sessions (company_id, terminal_id, opened_by, opening_float, currency, status)
       VALUES ($1, $2, $3, 0, $4, 'open') RETURNING id`, [companyId, terminal.id, state.user.id, currency]
    ))[0];

    // The client claims no discount; the server applies buy 2 get 1 on 3 bottles = 1,500 off
    const res = await postSale(req('/api/pos/transactions', 'POST', {
      company_id: companyId, session_id: session.id, currency,
      items: [{ product_id: productId, name: 'Juice', quantity: 3, unit_price: 1500, tax_rate: 0 }],
      payments: [{ method: 'cash', amount: 3000 }],
    }));
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(201);
    expect(Number(body.data.total)).toBe(3000);
    expect(body.promotions[0]).toMatchObject({ name: 'Buy 2 get 1', amount: 1500 });

    const lots = await q(`SELECT lot_number, quantity_remaining::float AS qty FROM inventory_lots
                          WHERE product_id = $1 AND lot_number IN ('LOT-A', 'LOT-B') ORDER BY lot_number`, [productId]);
    expect(lots).toEqual([{ lot_number: 'LOT-A', qty: 24 }, { lot_number: 'LOT-B', qty: 21 }]);
    const movement = (await q(`SELECT total_cost::float AS cost FROM inventory_movements WHERE reference_id = $1`, [body.data.id]))[0];
    expect(movement.cost).toBe(1650); // 3 x 550 from LOT-B
  });
});

describe('stock adjustments', () => {
  it('waits for approval when requested without approve, then writes off at FIFO cost', async () => {
    const res = await createAdjustment(req('/api/stock-adjustments', 'POST', {
      company_id: companyId, lines: [{ product_id: productId, quantity_change: -2, reason: 'damage', notes: 'dropped' }],
    }));
    const created = (await res.json()).data[0];
    expect(created.status).toBe('pending');
    expect((await product(productId)).qty).toBe(47); // unchanged until approved

    const list = await (await listAdjustments(req(`/api/stock-adjustments?company_id=${companyId}&status=pending`, 'GET'))).json();
    expect(list.can_approve).toBe(true);
    expect(list.data.some((a: any) => a.id === created.id)).toBe(true);

    const ok = await approveAdjustment(req(`/api/stock-adjustments/${created.id}/approve`, 'POST', {}), ctx(created.id));
    expect(ok.status, JSON.stringify(await ok.clone().json())).toBe(200);
    expect((await product(productId)).qty).toBe(45);

    const adj = (await q('SELECT status, total_cost::float AS cost, journal_entry_id FROM stock_adjustments WHERE id = $1', [created.id]))[0];
    expect(adj).toMatchObject({ status: 'approved', cost: 1100 }); // 2 x 550, LOT-B first
    expect(await lines(adj.journal_entry_id)).toEqual([
      { code: '5300', debit: 1100, credit: 0 },
      { code: '1200', debit: 0, credit: 1100 },
    ]);

    const twice = await approveAdjustment(req(`/api/stock-adjustments/${created.id}/approve`, 'POST', {}), ctx(created.id));
    expect(twice.status).toBe(400);
  });

  it('rejects without moving stock', async () => {
    const res = await createAdjustment(req('/api/stock-adjustments', 'POST', {
      company_id: companyId, product_id: productId, quantity_change: 5, reason: 'found',
    }));
    const created = (await res.json()).data[0];
    const rej = await rejectAdjustment(req(`/api/stock-adjustments/${created.id}/reject`, 'POST', { reason: 'miscount' }), ctx(created.id));
    expect(rej.status).toBe(200);
    expect((await product(productId)).qty).toBe(45);
  });

  it('turns a quantity typed on the product page into an approved count correction', async () => {
    const res = await editProduct(req(`/api/products/${productId}`, 'PATCH', { quantity_on_hand: 40, shelf_location: 'Aisle 3' }), ctx(productId));
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.stock_adjustment).toMatchObject({ status: 'approved' });
    expect(body.data).toMatchObject({ shelf_location: 'Aisle 3' });
    expect((await product(productId)).qty).toBe(40);
    await checkDeferredConstraints();
  });
});

describe('products', () => {
  it('creates a product with opening stock as a batch posted to Opening Balance Equity', async () => {
    const res = await createProduct(req(`/api/inventory?company_id=${companyId}`, 'POST', {
      sku: 'INT-OPEN-' + Date.now(), name: 'Int opening item', unit_cost: 200, unit_price: 400, currency,
      quantity_on_hand: 10, barcode: 'INT' + Date.now(), shelf_location: 'B2',
    }));
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(201);
    expect(Number(body.data.quantity_on_hand)).toBe(10);
    const entry = (await q(`SELECT id FROM journal_entries WHERE source_module = 'opening_stock' AND source_document_id = $1`, [body.data.id]))[0];
    expect(await lines(entry.id)).toEqual([
      { code: '1200', debit: 2000, credit: 0 },
      { code: '3050', debit: 0, credit: 2000 },
    ]);

    const variant = await createProduct(req(`/api/inventory?company_id=${companyId}`, 'POST', {
      sku: 'INT-VAR-' + Date.now(), name: 'Int opening item - Large', unit_cost: 250, unit_price: 500, currency,
      parent_product_id: body.data.id, variant_attributes: { Size: 'Large' },
    }));
    const v = await variant.json();
    expect(variant.status, JSON.stringify(v)).toBe(201);
    expect(v.data).toMatchObject({ parent_product_id: body.data.id, variant_attributes: { Size: 'Large' } });
    await checkDeferredConstraints();
  });
});
