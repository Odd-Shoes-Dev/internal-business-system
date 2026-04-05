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

// GET /api/tours/[id]/itineraries - Get tour itineraries
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
      'SELECT * FROM tour_itineraries WHERE tour_package_id = $1 ORDER BY day_number ASC',
      [id]
    );

    return NextResponse.json({ data: result.rows }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/tours/[id]/itineraries - Create itinerary
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
      `INSERT INTO tour_itineraries (
         tour_package_id, day_number, title, description, accommodation, meals, activities
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        body.day_number,
        body.title || null,
        body.description || null,
        body.accommodation || null,
        body.meals || null,
        body.activities || null,
      ]
    );

    return NextResponse.json({ data: insertResult.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/tours/[id]/itineraries/[itineraryId] - Update itinerary
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    const itineraryId = body.itineraryId;

    if (!itineraryId) {
      return NextResponse.json({ error: 'Itinerary ID required' }, { status: 400 });
    }

    const fields = Object.keys(body).filter((k) => k !== 'itineraryId');
    if (!fields.length) {
      const existing = await db.query('SELECT * FROM tour_itineraries WHERE id = $1 AND tour_package_id = $2 LIMIT 1', [
        itineraryId,
        id,
      ]);
      return NextResponse.json({ data: existing.rows[0] || null }, { status: 200 });
    }

    const setSql = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
    const values = fields.map((f) => body[f]);

    const updateResult = await db.query(
      `UPDATE tour_itineraries
       SET ${setSql}
       WHERE id = $1
         AND tour_package_id = $2
       RETURNING *`,
      [itineraryId, id, ...values]
    );

    return NextResponse.json({ data: updateResult.rows[0] || null }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/tours/[id]/itineraries/[itineraryId] - Delete itinerary
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const { searchParams } = new URL(request.url);
    const itineraryId = searchParams.get('itineraryId');

    if (!itineraryId) {
      return NextResponse.json({ error: 'Itinerary ID required' }, { status: 400 });
    }

    await db.query('DELETE FROM tour_itineraries WHERE id = $1 AND tour_package_id = $2', [itineraryId, id]);

    return NextResponse.json({ message: 'Itinerary deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
