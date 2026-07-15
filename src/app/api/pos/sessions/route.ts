import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser, requireCompanyAccess, getCompanyIdFromRequest } from '@/lib/provider/route-guards';

// GET /api/pos/sessions — list sessions for company
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) return companyAccessError;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'open' | 'closed'
    const limit = parseInt(searchParams.get('limit') || '50');

    const params: any[] = [companyId];
    const where: string[] = ['s.company_id = $1'];

    if (status) {
      params.push(status);
      where.push(`s.status = $${params.length}`);
    }

    const result = await db.query(
      `SELECT
         s.*,
         t.name AS terminal_name,
         p.full_name AS opened_by_name,
         pc.full_name AS closed_by_name
       FROM pos_sessions s
       LEFT JOIN pos_terminals t ON t.id = s.terminal_id
       LEFT JOIN user_profiles p ON p.id = s.opened_by
       LEFT JOIN user_profiles pc ON pc.id = s.closed_by
       WHERE ${where.join(' AND ')}
       ORDER BY s.opened_at DESC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/pos/sessions — open a new shift
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const { company_id, terminal_id, opening_float = 0, currency } = body;

    if (!company_id) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    if (!terminal_id) return NextResponse.json({ error: 'terminal_id is required' }, { status: 400 });

    const companyAccessError = await requireCompanyAccess(user.id, company_id);
    if (companyAccessError) return companyAccessError;

    // Check terminal belongs to company
    const terminalResult = await db.query(
      'SELECT id FROM pos_terminals WHERE id = $1 AND company_id = $2 AND is_active = true LIMIT 1',
      [terminal_id, company_id]
    );
    if (!terminalResult.rows[0]) {
      return NextResponse.json({ error: 'Terminal not found or inactive' }, { status: 404 });
    }

    // Check no open session exists on this terminal
    const openSession = await db.query(
      `SELECT id FROM pos_sessions WHERE terminal_id = $1 AND status = 'open' LIMIT 1`,
      [terminal_id]
    );
    if (openSession.rows[0]) {
      return NextResponse.json(
        { error: 'This terminal already has an open session', session_id: openSession.rows[0].id },
        { status: 409 }
      );
    }

    const result = await db.query(
      `INSERT INTO pos_sessions (company_id, terminal_id, opened_by, opening_float, currency, status)
       VALUES ($1, $2, $3, $4, $5, 'open')
       RETURNING *`,
      [company_id, terminal_id, user.id, opening_float, currency || 'UGX']
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
