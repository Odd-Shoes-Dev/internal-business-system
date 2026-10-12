import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/inventory/expiring?company_id=&days=30 — batches still in stock that have expired or
// expire within `days`, soonest first
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const days = Math.min(365, Math.max(0, parseInt(new URL(request.url).searchParams.get('days') || '30', 10) || 30));
    const result = await db.query(
      `SELECT l.id AS lot_id, l.lot_number, l.expiry_date::text AS expiry_date,
              (l.expiry_date - CURRENT_DATE) AS days_left,
              l.quantity_remaining::float AS quantity, l.unit_cost::float AS unit_cost,
              (l.quantity_remaining * l.unit_cost)::float AS value,
              p.id AS product_id, p.name AS product_name, p.sku, p.shelf_location, p.unit_of_measure
       FROM inventory_lots l
       JOIN products p ON p.id = l.product_id
       WHERE p.company_id = $1 AND l.quantity_remaining > 0 AND l.expiry_date IS NOT NULL
         AND l.expiry_date <= CURRENT_DATE + $2::int
       ORDER BY l.expiry_date ASC, p.name ASC`,
      [companyId, days]
    );
    return NextResponse.json({ data: result.rows, days });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
