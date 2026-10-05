import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { canManageTables } from './shared';

// GET /api/pos/tables?company_id=&all=true — active tables (all=true includes removed ones),
// each with its open order if it has one
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const all = new URL(request.url).searchParams.get('all') === 'true';
    const result = await db.query(
      `SELECT t.id, t.name, t.area, t.seats, t.sort_order, t.is_active,
              h.id AS order_id, h.cart, h.cart_discount, h.guests, h.customer_id, h.created_at AS opened_at,
              h.updated_at AS order_updated_at, c.name AS customer_name, c.loyalty_points AS customer_loyalty_points,
              c.whatsapp_number AS customer_whatsapp_number, c.phone AS customer_phone
       FROM restaurant_tables t
       LEFT JOIN pos_held_orders h ON h.table_id = t.id
       LEFT JOIN customers c ON c.id = h.customer_id
       WHERE t.company_id = $1 ${all ? '' : 'AND t.is_active'}
       ORDER BY t.area NULLS FIRST, t.sort_order, t.name`,
      [companyId]
    );
    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/pos/tables — { company_id, name, area?, seats? }
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const body = await request.json();
    const companyId = getCompanyIdFromRequest(request, body);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;
    if (!(await canManageTables(db, user.id, companyId))) {
      return NextResponse.json({ error: 'Your role cannot manage tables' }, { status: 403 });
    }

    const name = String(body.name || '').trim().slice(0, 50);
    if (!name) return NextResponse.json({ error: 'Name the table' }, { status: 400 });
    const result = await db.query(
      `INSERT INTO restaurant_tables (company_id, name, area, seats, sort_order)
       VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(sort_order) + 1 FROM restaurant_tables WHERE company_id = $1), 0))
       RETURNING *`,
      [companyId, name, String(body.area || '').trim().slice(0, 50) || null, Number(body.seats) > 0 ? Number(body.seats) : null]
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    if (error?.code === '23505') return NextResponse.json({ error: 'There is already a table with that name' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
