import { NextResponse } from 'next/server';
import { requireModuleAccess, requireSessionUser } from '@/lib/provider/route-guards';

export const TABLE_MANAGER_ROLES = ['owner', 'admin', 'operations'];

type Db = Awaited<ReturnType<typeof requireSessionUser>>['db'];
type Loaded = { error: NextResponse } | { db: Db; user: { id: string }; table: any };

// Loads a table and checks the user belongs to its company
export async function loadTable(id: string): Promise<Loaded> {
  const { db, user, errorResponse } = await requireSessionUser();
  if (errorResponse || !user) return { error: errorResponse ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const table = (await db.query<any>('SELECT * FROM restaurant_tables WHERE id = $1', [id])).rows[0];
  if (!table) return { error: NextResponse.json({ error: 'Table not found' }, { status: 404 }) };
  const accessError = await requireModuleAccess(user.id, table.company_id, 'pos');
  if (accessError) return { error: accessError };
  return { db, user, table };
}

export async function canManageTables(db: { query: (t: string, p?: any[]) => Promise<any> }, userId: string, companyId: string) {
  const r = await db.query('SELECT role FROM user_companies WHERE user_id = $1 AND company_id = $2', [userId, companyId]);
  return TABLE_MANAGER_ROLES.includes(r.rows[0]?.role || '');
}
