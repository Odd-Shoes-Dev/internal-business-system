import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/pos/held-orders?company_id= — parked carts, newest first
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const companyId = new URL(request.url).searchParams.get('company_id');
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const result = await db.query(
      `SELECT h.id, h.label, h.cart, h.cart_discount, h.customer_id, h.session_id, h.created_at,
              c.name AS customer_name, c.loyalty_points AS customer_loyalty_points,
              c.whatsapp_number AS customer_whatsapp_number, c.phone AS customer_phone,
              u.full_name AS created_by_name
       FROM pos_held_orders h
       LEFT JOIN customers c ON c.id = h.customer_id
       LEFT JOIN app_users u ON u.id = h.created_by
       WHERE h.company_id = $1
       ORDER BY h.created_at DESC
       LIMIT 100`,
      [companyId]
    );
    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/pos/held-orders — park a cart: { company_id, session_id?, label?, customer_id?, cart, cart_discount? }
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const { company_id, session_id, label, customer_id, cart, cart_discount } = body;
    if (!company_id) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    if (!Array.isArray(cart) || cart.length === 0) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });

    const accessError = await requireCompanyAccess(user.id, company_id);
    if (accessError) return accessError;

    if (customer_id) {
      const customer = await db.query('SELECT 1 FROM customers WHERE id = $1 AND company_id = $2', [customer_id, company_id]);
      if (!customer.rowCount) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const result = await db.query(
      `INSERT INTO pos_held_orders (company_id, session_id, label, customer_id, cart, cart_discount, created_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING *`,
      [company_id, session_id || null, (label || '').toString().slice(0, 100) || null, customer_id || null,
       JSON.stringify(cart), Number(cart_discount || 0), user.id]
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
