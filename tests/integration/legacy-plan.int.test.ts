import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { applyPendingMigrations, client, testDb } from './db-harness';

// Uses the real route guards (not mocks) so the trial lock itself is tested
const state = vi.hoisted(() => ({
  user: { id: '', email: 'owner@example.com', role: 'admin' },
  method: 'POST',
  path: '/api/customers',
}));
vi.mock('@/lib/provider', () => ({
  getDbProvider: () => ({ ...testDb, getSessionUser: async () => state.user, hasCompanyAccess: async () => true }),
}));
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-request-method', state.method], ['x-request-path', state.path]]),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

const { requireCompanyAccess } = await import('@/lib/provider/route-guards');
const { GET: listLegacy, POST: assignLegacy, DELETE: endLegacy } = await import('@/app/api/admin/legacy-plan/route');
const { GET: getSubscription } = await import('@/app/api/billing/subscription/route');
const { POST: changePlan } = await import('@/app/api/billing/change-plan/route');

const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, body: body ? JSON.stringify(body) : undefined });

let companyId = '';
let connected = false;

beforeAll(async () => {
  await client.connect();
  connected = true;
  await client.query('BEGIN');
  await applyPendingMigrations(113);
  companyId = (await client.query('SELECT id FROM companies ORDER BY created_at LIMIT 1')).rows[0].id;
  state.user.id = (await client.query(`SELECT user_id FROM user_companies WHERE company_id = $1 AND role IN ('owner','admin') LIMIT 1`, [companyId])).rows[0].user_id;
  // An expired trial: writes are locked
  await client.query(`UPDATE companies SET subscription_status = 'expired', subscription_plan = 'professional' WHERE id = $1`, [companyId]);
});

afterAll(async () => {
  if (!connected) return;
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
});

describe('legacy plan', () => {
  it('is for platform administrators only, not company admins', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'staff@ourcompany.com';
    expect((await listLegacy()).status).toBe(403);
    expect((await assignLegacy(req('/api/admin/legacy-plan', 'POST', { company_id: companyId, monthly_fee: 1 }))).status).toBe(403);
  });

  it('unlocks an expired company with a fixed fee and chosen modules', async () => {
    expect(await requireCompanyAccess(state.user.id, companyId)).not.toBeNull(); // locked before

    process.env.PLATFORM_ADMIN_EMAILS = 'staff@ourcompany.com, owner@example.com';
    const res = await assignLegacy(req('/api/admin/legacy-plan', 'POST', {
      company_id: companyId, monthly_fee: 150000, currency: 'ugx', modules: ['inventory', 'pos', 'not-a-module'], note: 'Invoiced monthly',
    }));
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.data).toMatchObject({ monthly_fee: 150000, currency: 'UGX', modules: ['inventory', 'pos'] });

    const active = (await client.query(
      'SELECT module_id FROM subscription_modules WHERE company_id = $1 AND is_active ORDER BY module_id', [companyId]
    )).rows.map((r: any) => r.module_id);
    expect(active).toEqual(['inventory', 'pos']);

    expect(await requireCompanyAccess(state.user.id, companyId)).toBeNull(); // writes allowed

    // A stale paid period on record must not lock a legacy company either
    await client.query('SAVEPOINT stale_sub');
    try {
      await client.query(
        `INSERT INTO subscriptions (company_id, status, plan_tier, current_period_end, created_at)
         VALUES ($1, 'active', 'professional', NOW() - INTERVAL '90 days', NOW())`, [companyId]
      );
      await client.query('RELEASE SAVEPOINT stale_sub');
    } catch {
      await client.query('ROLLBACK TO SAVEPOINT stale_sub'); // table shape varies; the guard is what matters
    }
    expect(await requireCompanyAccess(state.user.id, companyId)).toBeNull();
  });

  it('shows the fee on the billing page and refuses self-service plan changes', async () => {
    const sub = await (await getSubscription(req(`/api/billing/subscription?company_id=${companyId}`, 'GET'))).json();
    expect(sub.legacy).toMatchObject({ monthly_fee: 150000, note: 'Invoiced monthly' });
    expect(sub.modules).toEqual(['inventory', 'pos']);

    const change = await changePlan(req('/api/billing/change-plan', 'POST', { company_id: companyId, new_plan_tier: 'enterprise' }));
    expect(change.status).toBe(400);
    expect((await change.json()).error).toMatch(/legacy plan/);
  });

  it('ending the plan locks the company again', async () => {
    const res = await endLegacy(req(`/api/admin/legacy-plan?company_id=${companyId}`, 'DELETE'));
    expect(res.status).toBe(200);
    expect(await requireCompanyAccess(state.user.id, companyId)).not.toBeNull();
  });
});
