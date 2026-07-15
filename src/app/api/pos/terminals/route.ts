import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser, requireCompanyAccess, getCompanyIdFromRequest } from '@/lib/provider/route-guards';

// GET /api/pos/terminals — list terminals for company
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) return companyAccessError;

    const result = await db.query(
      `SELECT
         t.*,
         s.id AS open_session_id,
         s.opened_at,
         s.opened_by,
         p.full_name AS cashier_name,
         s.total_sales,
         s.transaction_count
       FROM pos_terminals t
       LEFT JOIN pos_sessions s ON s.terminal_id = t.id AND s.status = 'open'
       LEFT JOIN user_profiles p ON p.id = s.opened_by
       WHERE t.company_id = $1
       ORDER BY t.name ASC`,
      [companyId]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/pos/terminals — create a terminal
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const { company_id, name, description } = body;

    if (!company_id) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const companyAccessError = await requireCompanyAccess(user.id, company_id);
    if (companyAccessError) return companyAccessError;

    const result = await db.query(
      `INSERT INTO pos_terminals (company_id, name, description, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [company_id, name.trim(), description?.trim() || null]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
