import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

async function getTourAndCheckAccess(db: any, userId: string, tourId: string) {
  const result = await db.query('SELECT id, company_id FROM tour_packages WHERE id = $1 LIMIT 1', [tourId]);
  const tour = result.rows[0];
  if (!tour) {
    return { error: NextResponse.json({ error: 'Tour package not found' }, { status: 404 }) };
  }

  const companyAccessError = await requireCompanyAccess(userId, tour.company_id);
  if (companyAccessError) {
    return { error: companyAccessError };
  }

  return { tour };
}

// GET /api/tours/[id]/seasonal-pricing - Get seasonal pricing
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const guard = await getTourAndCheckAccess(db, user.id, id);
    if (guard.error) {
      return guard.error;
    }

    const result = await db.query(
      'SELECT * FROM tour_seasonal_pricing WHERE tour_package_id = $1 ORDER BY start_date ASC',
      [id]
    );

    return NextResponse.json({ data: result.rows }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/tours/[id]/seasonal-pricing - Create seasonal pricing
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const guard = await getTourAndCheckAccess(db, user.id, id);
    if (guard.error) {
      return guard.error;
    }

    const body = await request.json();

    const insertResult = await db.query(
      `INSERT INTO tour_seasonal_pricing (
         tour_package_id, season_name, start_date, end_date, price_per_person,
         single_supplement, child_discount_percent, is_peak_season
       ) VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        body.season_name || null,
        body.start_date,
        body.end_date,
        body.price_per_person,
        body.single_supplement || null,
        body.child_discount_percent || null,
        body.is_peak_season || false,
      ]
    );

    return NextResponse.json({ data: insertResult.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
